"""
Phase 6.1: Risk Scoring Pipeline.

Loads `model.joblib` at FastAPI startup and provides the core `compute_risk`
function that orchestrates:
1. Data extraction from analytics tables for a given `pseudonymous_id`
2. Point-in-time feature engineering (with zero temporal leakage)
3. Calibrated ML model inference via WelfareRiskModel
4. Calibrated score generation (0-100) & risk category banding (low/moderate/high/critical)
5. Plain-language feature importance explanation generation
"""

from __future__ import annotations

import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import uuid

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.explainability import get_top_contributing_factors
from app.features import _parse_date, compute_all_features_for_person
from app.models import (
    Deployment,
    DutyRecord,
    LeaveRecord,
    Recommendation,
    RiskScore,
    TrainingRecord,
    Transfer,
    WellnessAssessment,
)
from app.recommendations import evaluate_recommendations
from app.train_model import WelfareRiskModel
from app.rules import evaluate_deterministic_rules


# Module-level model cache
_LOADED_MODEL: Optional[WelfareRiskModel] = None

DEFAULT_MODEL_PATH = Path(__file__).resolve().parent / "model.joblib"


def load_risk_model(model_path: Optional[Union[str, Path]] = None) -> WelfareRiskModel:
    """
    Loads and caches the WelfareRiskModel from model.joblib.
    """
    global _LOADED_MODEL
    path = Path(model_path) if model_path else DEFAULT_MODEL_PATH

    if not path.exists():
        # Fall back to root model.joblib if needed
        fallback_path = Path(__file__).resolve().parent.parent / "model.joblib"
        if fallback_path.exists():
            path = fallback_path
        else:
            raise FileNotFoundError(f"Trained model artifact not found at {path} or {fallback_path}")

    _LOADED_MODEL = WelfareRiskModel.load(path)
    return _LOADED_MODEL


def get_risk_model() -> WelfareRiskModel:
    """
    Returns the loaded WelfareRiskModel, loading it if not already cached.
    """
    global _LOADED_MODEL
    if _LOADED_MODEL is None:
        _LOADED_MODEL = load_risk_model()
    return _LOADED_MODEL


def get_risk_category(calibrated_score: int) -> str:
    """
    Bands calibrated 0-100 risk score into standard operational categories:
    - critical: score >= 85
    - high:     score >= 65
    - moderate: score >= 35
    - low:      score < 35
    """
    if calibrated_score >= 85:
        return "critical"
    elif calibrated_score >= 65:
        return "high"
    elif calibrated_score >= 35:
        return "moderate"
    else:
        return "low"


def load_person_analytics_tables(
    db: Session,
    pseudonymous_id: Union[str, uuid.UUID],
) -> Dict[str, pd.DataFrame]:
    """
    Extracts all raw analytics table records for a specific individual
    into pandas DataFrames for feature engineering.
    """
    pid_uuid = uuid.UUID(str(pseudonymous_id))
    pid_str = str(pid_uuid).lower()

    # 1. Duty records
    duty_rows = db.query(DutyRecord).filter(DutyRecord.pseudonymous_id == pid_uuid).all()
    duty_df = pd.DataFrame(
        [
            {
                "pseudonymous_id": pid_str,
                "record_date": r.record_date,
                "shift_type": str(r.shift_type),
                "duty_hours": float(r.duty_hours) if r.duty_hours is not None else 0.0,
            }
            for r in duty_rows
        ],
        columns=["pseudonymous_id", "record_date", "shift_type", "duty_hours"],
    )

    # 2. Leave records
    leave_rows = db.query(LeaveRecord).filter(LeaveRecord.pseudonymous_id == pid_uuid).all()
    leave_df = pd.DataFrame(
        [
            {
                "pseudonymous_id": pid_str,
                "leave_type": str(r.leave_type),
                "start_date": r.start_date,
                "end_date": r.end_date,
            }
            for r in leave_rows
        ],
        columns=["pseudonymous_id", "leave_type", "start_date", "end_date"],
    )

    # 3. Deployments
    deploy_rows = db.query(Deployment).filter(Deployment.pseudonymous_id == pid_uuid).all()
    deploy_df = pd.DataFrame(
        [
            {
                "pseudonymous_id": pid_str,
                "deployment_type": str(r.deployment_type),
                "hardship_level": int(r.hardship_level) if r.hardship_level is not None else 1,
                "start_date": r.start_date,
                "end_date": r.end_date,
            }
            for r in deploy_rows
        ],
        columns=["pseudonymous_id", "deployment_type", "hardship_level", "start_date", "end_date"],
    )

    # 4. Transfers
    transfer_rows = db.query(Transfer).filter(Transfer.pseudonymous_id == pid_uuid).all()
    transfers_df = pd.DataFrame(
        [
            {
                "pseudonymous_id": pid_str,
                "transfer_date": r.transfer_date,
            }
            for r in transfer_rows
        ],
        columns=["pseudonymous_id", "transfer_date"],
    )

    # 5. Training records
    training_rows = db.query(TrainingRecord).filter(TrainingRecord.pseudonymous_id == pid_uuid).all()
    training_df = pd.DataFrame(
        [
            {
                "pseudonymous_id": pid_str,
                "training_date": r.training_date,
                "hours_committed": float(r.hours_committed) if r.hours_committed is not None else 0.0,
            }
            for r in training_rows
        ],
        columns=["pseudonymous_id", "training_date", "hours_committed"],
    )

    # 6. Wellness assessments
    wellness_rows = db.query(WellnessAssessment).filter(WellnessAssessment.pseudonymous_id == pid_uuid).all()
    wellness_df = pd.DataFrame(
        [
            {
                "pseudonymous_id": pid_str,
                "submitted_at": r.submitted_at,
                "mood_score": int(r.mood_score) if r.mood_score is not None else None,
                "sleep_quality_score": int(r.sleep_quality_score) if r.sleep_quality_score is not None else None,
                "stress_self_rating": int(r.stress_self_rating) if r.stress_self_rating is not None else None,
                "help_requested": bool(r.help_requested),
            }
            for r in wellness_rows
        ],
        columns=["pseudonymous_id", "submitted_at", "mood_score", "sleep_quality_score", "stress_self_rating", "help_requested"],
    )

    return {
        "duty_records": duty_df,
        "leave_records": leave_df,
        "deployments": deploy_df,
        "transfers": transfers_df,
        "training_records": training_df,
        "wellness_assessments": wellness_df,
    }


def determine_as_of_date(
    tables: Dict[str, pd.DataFrame],
    explicit_date: Optional[Union[datetime.date, str]] = None,
) -> datetime.date:
    """
    Determines the point-in-time calculation date. If explicit_date is provided,
    uses it. Otherwise finds the latest date across all individual records,
    or falls back to today's date if no records exist.
    """
    if explicit_date is not None:
        return _parse_date(explicit_date)

    dates: List[datetime.date] = []

    duty_df = tables.get("duty_records", pd.DataFrame())
    if not duty_df.empty and "record_date" in duty_df.columns:
        dates.extend([_parse_date(d) for d in duty_df["record_date"].dropna()])

    wellness_df = tables.get("wellness_assessments", pd.DataFrame())
    if not wellness_df.empty and "submitted_at" in wellness_df.columns:
        dates.extend([_parse_date(d) for d in wellness_df["submitted_at"].dropna()])

    training_df = tables.get("training_records", pd.DataFrame())
    if not training_df.empty and "training_date" in training_df.columns:
        dates.extend([_parse_date(d) for d in training_df["training_date"].dropna()])

    leave_df = tables.get("leave_records", pd.DataFrame())
    if not leave_df.empty:
        if "end_date" in leave_df.columns:
            dates.extend([_parse_date(d) for d in leave_df["end_date"].dropna()])
        if "start_date" in leave_df.columns:
            dates.extend([_parse_date(d) for d in leave_df["start_date"].dropna()])

    deploy_df = tables.get("deployments", pd.DataFrame())
    if not deploy_df.empty:
        if "end_date" in deploy_df.columns:
            dates.extend([_parse_date(d) for d in deploy_df["end_date"].dropna()])
        if "start_date" in deploy_df.columns:
            dates.extend([_parse_date(d) for d in deploy_df["start_date"].dropna()])

    transfers_df = tables.get("transfers", pd.DataFrame())
    if not transfers_df.empty and "transfer_date" in transfers_df.columns:
        dates.extend([_parse_date(d) for d in transfers_df["transfer_date"].dropna()])

    if dates:
        return max(dates)

    return datetime.date.today()


def compute_risk(
    pseudonymous_id: Union[str, uuid.UUID],
    db: Optional[Session] = None,
    as_of_date: Optional[Union[datetime.date, str]] = None,
    model: Optional[WelfareRiskModel] = None,
    save_to_db: bool = False,
) -> Dict[str, Any]:
    """
    Core Risk Scoring function (Phase 6.1).

    Executes:
    1. Feature engineering for target individual as of as_of_date
    2. Model inference with calibrated probabilities via Platt scaling
    3. Calibrated score mapping (0-100) & risk category banding (low/moderate/high/critical)
    4. Plain-language feature attribution / contributing factors
    5. Optional database persistence to analytics.risk_scores

    Args:
        pseudonymous_id: Analytics UUID of the personnel.
        db: SQLAlchemy session (created if omitted).
        as_of_date: Point-in-time calculation date (auto-detected if omitted).
        model: WelfareRiskModel instance (loads cached model if omitted).
        save_to_db: Whether to write the score record to analytics.risk_scores.

    Returns:
        Dictionary containing:
        - pseudonymous_id: str
        - probability_score: float
        - calibrated_score: int (0-100)
        - risk_category: str ('low' | 'moderate' | 'high' | 'critical')
        - risk_tier: str (alias for risk_category)
        - welfare_concern_30d: bool
        - contributing_factors: List[str]
        - features: Dict[str, Any]
        - as_of_date: str (YYYY-MM-DD)
        - computed_at: datetime
        - risk_score_id: Optional[str]
    """
    pid_uuid = uuid.UUID(str(pseudonymous_id))
    pid_str = str(pid_uuid).lower()

    # Acquire DB session if not provided
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True

    try:
        # 1. Load Analytics Tables
        tables = load_person_analytics_tables(db, pid_uuid)

        # 2. Determine point-in-time calculation date
        effective_as_of = determine_as_of_date(tables, as_of_date)

        # 3. Feature Engineering
        features = compute_all_features_for_person(tables, pid_uuid, effective_as_of)

        # 4. Model Prediction & Calibration
        risk_model = model or get_risk_model()
        prediction = risk_model.predict_risk_score(features, top_k=3)

        probability_score = float(prediction["probability_score"])
        raw_calibrated_score = int(prediction["calibrated_score"])
        raw_risk_category = get_risk_category(raw_calibrated_score)
        contributing_factors = list(prediction.get("contributing_factors", []))

        # 5. Deterministic Rule Engine Layer (Phase 6.2)
        # Rules can ONLY escalate the category, never lower it
        rule_eval = evaluate_deterministic_rules(
            features=features,
            raw_category=raw_risk_category,
            raw_score=raw_calibrated_score,
        )

        final_category = rule_eval["final_category"]
        final_score = rule_eval["final_score"]
        rule_flags = rule_eval["rule_flags"]
        is_escalated = rule_eval["escalated"]

        welfare_concern = final_category in ("high", "critical")

        # If rules triggered escalation, ensure the explanation is surfaced prominently
        if is_escalated and rule_eval["triggered_reasons"]:
            for reason in reversed(rule_eval["triggered_reasons"]):
                if not any(reason.lower() in f.lower() for f in contributing_factors):
                    contributing_factors.insert(0, reason)
            contributing_factors = contributing_factors[:3]

        # 6. Recommendation Evaluation (Phase 7.1)
        recommendations = evaluate_recommendations(
            features=features,
            risk_category=final_category,
            risk_score=final_score,
        )

        computed_at = datetime.datetime.now(datetime.timezone.utc)
        risk_score_id: Optional[str] = None

        # 7. Optional DB Persistence
        if save_to_db:
            score_record = RiskScore(
                id=uuid.uuid4(),
                pseudonymous_id=pid_uuid,
                computed_at=computed_at,
                probability_score=probability_score,
                calibrated_score=final_score,
                risk_category=final_category,
                contributing_factors=contributing_factors,
                rule_flags=rule_flags,
            )
            db.add(score_record)
            db.flush()

            for rec in recommendations:
                rec_record = Recommendation(
                    id=uuid.uuid4(),
                    risk_score_id=score_record.id,
                    recommendation_type=rec["recommendation_type"],
                    rationale=rec["rationale"],
                    generated_at=computed_at,
                )
                db.add(rec_record)

            db.commit()
            db.refresh(score_record)
            risk_score_id = str(score_record.id)

        return {
            "pseudonymous_id": pid_str,
            "probability_score": probability_score,
            "raw_calibrated_score": raw_calibrated_score,
            "calibrated_score": final_score,
            "raw_risk_category": raw_risk_category,
            "risk_category": final_category,
            "risk_tier": final_category,
            "welfare_concern_30d": welfare_concern,
            "contributing_factors": contributing_factors,
            "features": features,
            "rule_flags": rule_flags,
            "recommendations": recommendations,
            "escalated_by_rules": is_escalated,
            "as_of_date": effective_as_of.isoformat(),
            "computed_at": computed_at,
            "risk_score_id": risk_score_id,
        }

    finally:
        if own_session:
            db.close()
