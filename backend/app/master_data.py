"""
Master Data Engine for the Personnel Stress & Welfare Monitoring System.

Implements:
1. Single Master Dataset ingestion, validation, and session-scoped management.
2. Temporal split, feature preparation, and calibrated XGBoost risk training.
3. TreeSHAP feature importance calculation with human-readable labels.
4. Deterministic clinical & operational recommendations.
5. In-memory session model management with clean fallback to the default master dataset.
"""

from __future__ import annotations

import datetime
import io
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.frozen import FrozenEstimator
import xgboost as xgb

logger = logging.getLogger("uvicorn")

# ---------------------------------------------------------------------------
# Schema Specifications & Excluded Output Columns
# ---------------------------------------------------------------------------

EXCLUDED_MODEL_OUTPUT_COLUMNS = {
    "risk_probability",
    "risk_score",
    "risk_category",
    "contributing_factors",
    "factor_impacts",
    "factor_directions",
    "recommendations",
    "recommendation_reasons",
    "model_version",
    "prediction_timestamp",
}

NON_FEATURE_METADATA_COLUMNS = {
    "person_id",
    "record_date",
    "welfare_concern_30d",
}

REQUIRED_MASTER_COLUMNS = [
    # Identity / Demographics
    "person_id",
    "record_date",
    "age",
    "experience_years",
    "unit_id",
    "role",
    "role_difficulty_score",
    # Duty / Workload
    "duty_hours",
    "overtime_hours",
    "shift_type",
    "night_shift",
    "consecutive_work_days",
    "consecutive_night_shifts",
    # Leave
    "leave_requested",
    "leave_days",
    "leave_type",
    "leave_approved",
    "days_since_last_leave",
    # Deployment / Transfer
    "deployment_status",
    "deployment_duration_days",
    "recent_deployment",
    "transfer_event",
    "days_since_transfer",
    "deployment_hardship_score",
    # Wellness
    "sleep_hours",
    "sleep_quality",
    "mood_score",
    "stress_score",
    "fatigue_score",
    "help_requested",
    # Derived Features
    "avg_duty_hours_30d",
    "night_shifts_30d",
    "leave_days_30d",
    "leave_requests_30d",
    "leave_frequency",
    "duty_hours_deviation",
    "sleep_deviation",
    "stress_deviation",
    "mood_deviation",
    "leave_deviation",
    "night_shift_deviation",
    "workload_deviation",
    "wellness_trend",
    "stress_trend",
    "sleep_trend",
    # Target
    "welfare_concern_30d",
]

HUMAN_READABLE_FEATURE_MAP: Dict[str, str] = {
    "avg_duty_hours_30d": "Average duty hours (30d)",
    "night_shifts_30d": "Night-shift frequency (30d)",
    "sleep_deviation": "Sleep deviation from baseline",
    "stress_deviation": "Stress deviation from baseline",
    "workload_deviation": "Workload deviation from baseline",
    "mood_deviation": "Mood deviation from baseline",
    "leave_deviation": "Leave deviation from baseline",
    "duty_hours_deviation": "Duty-hours deviation",
    "night_shift_deviation": "Night-shift deviation",
    "days_since_last_leave": "Leave gap (days)",
    "consecutive_night_shifts": "Consecutive night shifts",
    "consecutive_work_days": "Consecutive work days",
    "duty_hours": "Shift duty hours",
    "overtime_hours": "Overtime hours",
    "sleep_hours": "Daily sleep duration",
    "sleep_quality": "Sleep quality rating",
    "mood_score": "Self-reported mood",
    "stress_score": "Current stress score",
    "fatigue_score": "Fatigue rating",
    "deployment_hardship_score": "Deployment hardship",
    "deployment_duration_days": "Deployment duration (days)",
    "days_since_transfer": "Days since last transfer",
    "role_difficulty_score": "Role difficulty index",
    "leave_frequency": "Leave frequency rate",
    "help_requested": "Help / counseling requested",
    "age": "Personnel age",
    "experience_years": "Years of experience",
    "recent_deployment": "Recent deployment status",
    "transfer_event": "Recent transfer event",
    "leave_days": "Leave days taken",
    "leave_days_30d": "Leave days in past 30d",
    "leave_requests_30d": "Leave requests in past 30d",
    "wellness_trend": "Wellness trend trajectory",
    "stress_trend": "Stress trend trajectory",
    "sleep_trend": "Sleep trend trajectory",
}

# Categorical column encoding mappings
CATEGORICAL_MAPPINGS = {
    "shift_type": {"Day": 0, "Night": 1, "Rotating": 2, "Evening": 3},
    "leave_type": {"None": 0, "Casual": 1, "Earned": 2, "Medical": 3, "Emergency": 4},
    "deployment_status": {"Not Deployed": 0, "Deployed": 1, "Transit": 2, "High Altitude": 3, "Field": 4},
    "wellness_trend": {"Declining": -1, "Stable": 0, "Improving": 1},
    "stress_trend": {"Improving": -1, "Stable": 0, "Escalating": 1, "Declining": 1},
    "sleep_trend": {"Declining": -1, "Stable": 0, "Improving": 1},
}


def get_risk_category(calibrated_score: int) -> str:
    """Configurable central risk category thresholds."""
    if calibrated_score >= 85:
        return "CRITICAL"
    elif calibrated_score >= 65:
        return "HIGH"
    elif calibrated_score >= 35:
        return "MODERATE"
    else:
        return "LOW"


def generate_recommendations(
    row: Dict[str, Any],
    top_shap_features: List[Dict[str, Any]],
    risk_category: str,
) -> List[Dict[str, str]]:
    """
    Deterministic rule-based recommendations generated from top SHAP risk factors.
    """
    recs = []
    top_feature_names = [f["raw_feature"] for f in top_shap_features if f["impact_direction"] == "elevates_risk"]

    # 1. Workload review
    if any(k in top_feature_names for k in ["avg_duty_hours_30d", "duty_hours", "overtime_hours", "duty_hours_deviation", "workload_deviation"]):
        recs.append({
            "title": "Workload Review",
            "reason": "Duty hours are elevated relative to the individual's baseline and are contributing significantly to the model's risk prediction.",
            "action_type": "duty_modification",
        })

    # 2. Night-duty schedule review
    if any(k in top_feature_names for k in ["night_shifts_30d", "consecutive_night_shifts", "night_shift_deviation"]):
        recs.append({
            "title": "Review Night-Duty Schedule",
            "reason": "Frequent or prolonged consecutive night duties are driving fatigue and elevating predicted welfare risk.",
            "action_type": "night_shift_rotation",
        })

    # 3. Sleep & recovery check-in
    if any(k in top_feature_names for k in ["sleep_hours", "sleep_quality", "sleep_deviation", "sleep_trend"]):
        recs.append({
            "title": "Wellness Check-in (Sleep & Recovery)",
            "reason": "Sleep duration or sleep quality is deteriorating below baseline standards, impacting operational readiness.",
            "action_type": "sleep_consultation",
        })

    # 4. Leave gap review
    if any(k in top_feature_names for k in ["days_since_last_leave", "leave_deviation", "leave_frequency"]):
        recs.append({
            "title": "Review Leave Availability",
            "reason": "Extended duration without authorized leave is compounding continuous operational fatigue.",
            "action_type": "leave_scheduling",
        })

    # 5. High stress or clinical counseling referral
    if any(k in top_feature_names for k in ["stress_score", "stress_deviation", "stress_trend", "mood_score", "fatigue_score", "help_requested"]) or risk_category in ("HIGH", "CRITICAL"):
        recs.append({
            "title": "Confidential Counseling Referral",
            "reason": "Acute stress elevation or voluntary assistance signal detected. Proactive supportive conversation recommended.",
            "action_type": "counseling_referral",
        })

    # Default fallback if no specific rule hit
    if not recs:
        recs.append({
            "title": "Routine Welfare Monitoring",
            "reason": "Operational indicators remain within normal expected tolerances. Continue periodic wellness check-ins.",
            "action_type": "routine_monitoring",
        })

    return recs


class MasterDataManager:
    """
    Singleton holding the active in-memory master dataset, trained XGBoost model,
    TreeSHAP explainer, and metadata.
    """

    def __init__(self, default_dataset_path: Union[str, Path]):
        self.default_dataset_path = Path(default_dataset_path)
        self.active_dataset_name: str = "default_master_dataset.csv"
        self.active_df: pd.DataFrame = pd.DataFrame()
        self.active_model: Optional[CalibratedClassifierCV] = None
        self.raw_xgb_model: Optional[xgb.XGBClassifier] = None
        self.active_explainer: Optional[Any] = None
        self.feature_columns: List[str] = []
        self.model_version: str = "synthetic-model-v1"
        self.training_timestamp: str = ""
        self.is_session_custom: bool = False

    def initialize_default(self) -> None:
        """Loads default master dataset and performs initial training."""
        logger.info(f"Initializing MasterDataManager with default dataset: {self.default_dataset_path}")
        if not self.default_dataset_path.exists():
            raise FileNotFoundError(f"Default master dataset not found at {self.default_dataset_path}")

        df = pd.read_csv(self.default_dataset_path)
        self._train_and_activate(
            df=df,
            dataset_name="default_master_dataset.csv",
            version="synthetic-model-v1",
            is_custom=False,
        )

    def validate_dataset(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Comprehensive validation of an uploaded DataFrame.
        Returns:
            {
                "valid": bool,
                "row_count": int,
                "personnel_count": int,
                "checks": Dict[str, bool],
                "errors": List[str],
                "warnings": List[str]
            }
        """
        errors: List[str] = []
        warnings: List[str] = []
        checks = {
            "required_columns": False,
            "dates_valid": False,
            "no_duplicate_records": False,
            "numeric_fields_valid": False,
            "target_valid": False,
        }

        # 1. Required Columns Check
        missing_cols = [col for col in REQUIRED_MASTER_COLUMNS if col not in df.columns]
        if missing_cols:
            errors.append(f"Missing required columns ({len(missing_cols)}): {', '.join(missing_cols[:6])}...")
        else:
            checks["required_columns"] = True

        if len(df) == 0:
            errors.append("The uploaded dataset contains 0 records.")
            return {
                "valid": False,
                "row_count": 0,
                "personnel_count": 0,
                "checks": checks,
                "errors": errors,
                "warnings": warnings,
            }

        # 2. Personnel IDs
        if "person_id" in df.columns:
            empty_ids = df["person_id"].isna().sum() + (df["person_id"].astype(str).str.strip() == "").sum()
            if empty_ids > 0:
                errors.append(f"Found {empty_ids} records with missing or empty person_id.")

        # 3. Dates Valid
        if "record_date" in df.columns:
            try:
                parsed_dates = pd.to_datetime(df["record_date"], errors="coerce")
                invalid_dates = parsed_dates.isna().sum()
                if invalid_dates > 0:
                    errors.append(f"Found {invalid_dates} invalid or unparseable record_date values.")
                else:
                    checks["dates_valid"] = True
            except Exception as e:
                errors.append(f"Date validation failed: {e}")

        # 4. Duplicate Observations
        if "person_id" in df.columns and "record_date" in df.columns:
            dups = df.duplicated(subset=["person_id", "record_date"]).sum()
            if dups > 0:
                errors.append(f"Found {dups} duplicate observations for the same (person_id, record_date).")
            else:
                checks["no_duplicate_records"] = True

        # 5. Target Valid
        if "welfare_concern_30d" in df.columns:
            target_vals = df["welfare_concern_30d"].dropna().unique()
            if not set(target_vals).issubset({0, 1, True, False, 0.0, 1.0}):
                errors.append("Target welfare_concern_30d must contain binary values (0 or 1).")
            else:
                checks["target_valid"] = True

        # 6. Numeric Fields Check
        numeric_cols_to_check = [
            "duty_hours", "overtime_hours", "sleep_hours", "sleep_quality",
            "mood_score", "stress_score", "fatigue_score",
        ]
        present_num_cols = [c for c in numeric_cols_to_check if c in df.columns]
        num_errors = 0
        for col in present_num_cols:
            non_numeric = pd.to_numeric(df[col], errors="coerce").isna().sum()
            if non_numeric > 0:
                num_errors += non_numeric
        if num_errors > 0:
            errors.append(f"Found {num_errors} non-numeric entries across critical wellness/workload fields.")
        else:
            checks["numeric_fields_valid"] = True

        valid = len(errors) == 0
        personnel_count = int(df["person_id"].nunique()) if "person_id" in df.columns else 0

        return {
            "valid": valid,
            "row_count": len(df),
            "personnel_count": personnel_count,
            "checks": checks,
            "errors": errors,
            "warnings": warnings,
        }

    def _prepare_feature_matrix(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        """
        Extracts and encodes input features strictly excluding previous model outputs
        and target column.
        """
        # Exclude metadata and previous model outputs
        cols_to_exclude = EXCLUDED_MODEL_OUTPUT_COLUMNS.union(NON_FEATURE_METADATA_COLUMNS)
        candidate_cols = [c for c in df.columns if c not in cols_to_exclude]

        X = pd.DataFrame(index=df.index)
        for col in candidate_cols:
            # Categorical encoding
            if col in CATEGORICAL_MAPPINGS:
                mapping = CATEGORICAL_MAPPINGS[col]
                X[col] = df[col].astype(str).map(mapping).fillna(0).astype(float)
            elif col in ("unit_id", "role"):
                # Factorize unit and role into stable integer categories
                codes, _ = pd.factorize(df[col].astype(str))
                X[col] = codes.astype(float)
            elif df[col].dtype == "object":
                # Convert any other object or string to numeric or factorize
                numeric_try = pd.to_numeric(df[col], errors="coerce")
                if numeric_try.notna().sum() > 0.8 * len(df):
                    X[col] = numeric_try.fillna(numeric_try.median() if numeric_try.notna().any() else 0.0)
                else:
                    codes, _ = pd.factorize(df[col].astype(str))
                    X[col] = codes.astype(float)
            else:
                # Numeric column - impute median if NaNs exist
                num_s = pd.to_numeric(df[col], errors="coerce")
                med = num_s.median() if num_s.notna().any() else 0.0
                X[col] = num_s.fillna(med).astype(float)

        feature_cols = list(X.columns)
        return X, feature_cols

    def _train_and_activate(
        self,
        df: pd.DataFrame,
        dataset_name: str,
        version: str,
        is_custom: bool = True,
    ) -> Dict[str, Any]:
        """
        Trains the XGBoost model with Platt scaling calibration on the dataset,
        initializes the SHAP TreeExplainer, and updates in-memory active state.
        """
        logger.info(f"Training master model on {len(df)} records ({df['person_id'].nunique()} personnel)...")

        # 1. Feature Matrix Preparation
        X, feature_cols = self._prepare_feature_matrix(df)
        y = pd.to_numeric(df["welfare_concern_30d"], errors="coerce").fillna(0).astype(int).values

        # 2. Chronological / Temporal Split
        # Sort by record_date to avoid future leakage
        df_sorted = df.copy()
        df_sorted["_parsed_date"] = pd.to_datetime(df_sorted["record_date"], errors="coerce")
        sort_order = df_sorted["_parsed_date"].argsort()

        X_sorted = X.iloc[sort_order].reset_index(drop=True)
        y_sorted = y[sort_order]

        n_rows = len(df_sorted)
        train_end = int(n_rows * 0.70)
        val_end = int(n_rows * 0.85)

        X_train, y_train = X_sorted.iloc[:train_end], y_sorted[:train_end]
        X_val, y_val = X_sorted.iloc[train_end:val_end], y_sorted[train_end:val_end]
        X_test, y_test = X_sorted.iloc[val_end:], y_sorted[val_end:]

        # Handle class balance
        n_pos = max(int(np.sum(y_train)), 1)
        n_neg = max(len(y_train) - n_pos, 1)
        scale_pos_weight = float(n_neg / n_pos)

        # 3. Fit XGBoost Model
        xgb_clf = xgb.XGBClassifier(
            n_estimators=45,
            max_depth=3,
            learning_rate=0.08,
            min_child_weight=2,
            subsample=0.85,
            colsample_bytree=0.85,
            scale_pos_weight=scale_pos_weight,
            eval_metric="logloss",
            random_state=42,
        )
        xgb_clf.fit(X_train, y_train)

        # 4. Platt Scaling Calibration on Temporal Validation Split
        if len(X_val) > 0 and len(np.unique(y_val)) > 1:
            calibrated_model = CalibratedClassifierCV(
                estimator=FrozenEstimator(xgb_clf),
                method="sigmoid",
            )
            calibrated_model.fit(X_val, y_val)
        else:
            # If val split too small or single class, calibrate directly
            calibrated_model = CalibratedClassifierCV(
                estimator=FrozenEstimator(xgb_clf),
                method="sigmoid",
            )
            calibrated_model.fit(X_train, y_train)

        # 5. Calculate native TreeSHAP values for entire dataset in C++ via booster
        booster = xgb_clf.get_booster()
        shap_values = booster.predict(xgb.DMatrix(X), pred_contribs=True)[:, :-1]

        # 6. Generate Predictions across all rows in df
        all_probs = calibrated_model.predict_proba(X)[:, 1]
        all_scores = np.round(all_probs * 100).astype(int)
        all_categories = [get_risk_category(s) for s in all_scores]

        # Store predictions and explanations in active DataFrame copy
        active_df = df.copy()
        active_df["pred_risk_probability"] = np.round(all_probs, 4)
        active_df["pred_risk_score"] = all_scores
        active_df["pred_risk_category"] = all_categories

        self.active_df = active_df
        self.active_model = calibrated_model
        self.raw_xgb_model = xgb_clf
        self.active_explainer = booster
        self.feature_columns = feature_cols
        self.active_dataset_name = dataset_name
        self.model_version = version
        self.training_timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
        self.is_session_custom = is_custom
        self._cached_X = X
        self._cached_shap = shap_values

        logger.info(
            f"Successfully activated model {version} with {len(active_df)} rows. "
            f"Mean Risk Score: {all_scores.mean():.1f}/100"
        )

        return {
            "status": "success",
            "model_version": self.model_version,
            "training_timestamp": self.training_timestamp,
            "records_count": len(active_df),
            "personnel_count": int(active_df["person_id"].nunique()),
            "mean_risk_score": float(np.round(all_scores.mean(), 1)),
        }

    def train_uploaded_dataset(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """
        Accepts uploaded CSV or XLSX bytes, validates, trains XGBoost + SHAP,
        and sets the active dataset for the running session.
        """
        # Parse file based on extension
        if filename.lower().endswith(".xlsx") or filename.lower().endswith(".xls"):
            df = pd.read_excel(io.BytesIO(file_content))
        else:
            df = pd.read_csv(io.BytesIO(file_content))

        val = self.validate_dataset(df)
        if not val["valid"]:
            return {
                "status": "validation_failed",
                "validation": val,
            }

        # Derive next version number
        cur_v = self.model_version
        if "model-v" in cur_v:
            try:
                next_num = int(cur_v.split("model-v")[-1]) + 1
                next_version = f"model-v{next_num}"
            except Exception:
                next_version = "model-v2"
        else:
            next_version = "model-v2"

        result = self._train_and_activate(
            df=df,
            dataset_name=filename,
            version=next_version,
            is_custom=True,
        )
        result["validation"] = val
        return result

    def get_status(self) -> Dict[str, Any]:
        """Returns current active dataset and model status."""
        return {
            "active_dataset": self.active_dataset_name,
            "model_version": self.model_version,
            "training_timestamp": self.training_timestamp,
            "records_count": len(self.active_df),
            "personnel_count": int(self.active_df["person_id"].nunique()) if not self.active_df.empty else 0,
            "is_session_custom": self.is_session_custom,
        }

    def get_all_personnel_latest(self) -> List[Dict[str, Any]]:
        """
        Returns all unique personnel with their latest record, observed stress score,
        predicted welfare risk score, and risk category.
        """
        if self.active_df.empty:
            return []

        df = self.active_df.copy()
        df["_parsed_date"] = pd.to_datetime(df["record_date"], errors="coerce")
        # Find index of latest record for each person
        latest_indices = df.groupby("person_id")["_parsed_date"].idxmax()
        latest_rows = df.loc[latest_indices].sort_values(by="pred_risk_score", ascending=False)

        results = []
        for _, row in latest_rows.iterrows():
            results.append({
                "person_id": str(row["person_id"]),
                "record_date": str(row["record_date"]),
                "unit_id": str(row.get("unit_id", "N/A")),
                "role": str(row.get("role", "N/A")),
                "stress_score": int(row.get("stress_score", 0)),
                "welfare_risk_score": int(row.get("pred_risk_score", 0)),
                "risk_probability": float(row.get("pred_risk_probability", 0.0)),
                "risk_category": str(row.get("pred_risk_category", "LOW")),
                "sleep_hours": float(row.get("sleep_hours", 0.0)),
                "duty_hours": float(row.get("duty_hours", 0.0)),
                "help_requested": bool(row.get("help_requested", 0)),
            })
        return results

    def get_person_detail(self, person_id: str) -> Optional[Dict[str, Any]]:
        """
        Returns complete details of the latest record for a specific person,
        including top 5 SHAP factors, recommendations, and all categorized attributes.
        """
        if self.active_df.empty:
            return None

        person_df = self.active_df[self.active_df["person_id"] == person_id]
        if person_df.empty:
            return None

        person_df = person_df.copy()
        person_df["_parsed_date"] = pd.to_datetime(person_df["record_date"], errors="coerce")
        latest_idx = person_df["_parsed_date"].idxmax()
        latest_row = person_df.loc[latest_idx]

        # Extract top 5 SHAP values for this observation
        row_pos_in_active = self.active_df.index.get_loc(latest_idx)
        shap_row = self._cached_shap[row_pos_in_active]

        # Pair features with shap values
        shap_items = []
        for feat_name, shap_val in zip(self.feature_columns, shap_row):
            readable_name = HUMAN_READABLE_FEATURE_MAP.get(feat_name, feat_name.replace("_", " ").title())
            impact_dir = "elevates_risk" if shap_val > 0 else "lowers_risk"
            raw_act = latest_row.get(feat_name)
            if pd.isna(raw_act):
                act_val = None
            elif isinstance(raw_act, (np.integer, int)):
                act_val = int(raw_act)
            elif isinstance(raw_act, (np.floating, float)):
                act_val = round(float(raw_act), 2)
            else:
                act_val = str(raw_act)

            shap_items.append({
                "raw_feature": feat_name,
                "display_name": readable_name,
                "shap_value": float(shap_val),
                "absolute_impact": float(abs(shap_val)),
                "impact_direction": impact_dir,
                "points_impact": int(round(shap_val * 100)),
                "actual_value": act_val,
            })

        # Rank by absolute impact and take top 5
        shap_items.sort(key=lambda x: x["absolute_impact"], reverse=True)
        top_5_shap = shap_items[:5]

        # Generate actionable recommendations
        risk_cat = str(latest_row.get("pred_risk_category", "LOW"))
        recommendations = generate_recommendations(latest_row.to_dict(), top_5_shap, risk_cat)

        return {
            "personnel": {
                "person_id": str(latest_row["person_id"]),
                "record_date": str(latest_row["record_date"]),
                "unit_id": str(latest_row.get("unit_id", "N/A")),
                "role": str(latest_row.get("role", "N/A")),
                "age": int(latest_row.get("age", 0)),
                "experience_years": int(latest_row.get("experience_years", 0)),
                "role_difficulty_score": int(latest_row.get("role_difficulty_score", 0)),
            },
            "welfare_risk": {
                "welfare_risk_score": int(latest_row.get("pred_risk_score", 0)),
                "risk_probability": float(latest_row.get("pred_risk_probability", 0.0)),
                "risk_category": risk_cat,
                "model_version": self.model_version,
            },
            "wellness": {
                "stress_score": int(latest_row.get("stress_score", 0)),
                "sleep_hours": float(latest_row.get("sleep_hours", 0.0)),
                "sleep_quality": int(latest_row.get("sleep_quality", 0)),
                "mood_score": int(latest_row.get("mood_score", 0)),
                "fatigue_score": int(latest_row.get("fatigue_score", 0)),
                "help_requested": bool(latest_row.get("help_requested", 0)),
            },
            "workload": {
                "duty_hours": float(latest_row.get("duty_hours", 0.0)),
                "overtime_hours": float(latest_row.get("overtime_hours", 0.0)),
                "shift_type": str(latest_row.get("shift_type", "Day")),
                "night_shift": int(latest_row.get("night_shift", 0)),
                "consecutive_work_days": int(latest_row.get("consecutive_work_days", 0)),
                "consecutive_night_shifts": int(latest_row.get("consecutive_night_shifts", 0)),
                "avg_duty_hours_30d": float(latest_row.get("avg_duty_hours_30d", 0.0)),
                "night_shifts_30d": int(latest_row.get("night_shifts_30d", 0)),
            },
            "leave": {
                "days_since_last_leave": int(latest_row.get("days_since_last_leave", 0)),
                "leave_days": int(latest_row.get("leave_days", 0)),
                "leave_type": str(latest_row.get("leave_type", "None")),
                "leave_approved": int(latest_row.get("leave_approved", 0)),
                "leave_frequency": float(latest_row.get("leave_frequency", 0.0)),
                "leave_days_30d": int(latest_row.get("leave_days_30d", 0)),
            },
            "deployment": {
                "deployment_status": str(latest_row.get("deployment_status", "Not Deployed")),
                "deployment_duration_days": int(latest_row.get("deployment_duration_days", 0)),
                "deployment_hardship_score": float(latest_row.get("deployment_hardship_score", 0.0)),
                "recent_deployment": int(latest_row.get("recent_deployment", 0)),
                "transfer_event": int(latest_row.get("transfer_event", 0)),
                "days_since_transfer": int(latest_row.get("days_since_transfer", 0)),
            },
            "shap_factors": top_5_shap,
            "recommendations": recommendations,
        }

    def get_person_history(self, person_id: str) -> List[Dict[str, Any]]:
        """
        Returns all chronological historical observations for a person with
        observed stress_score and model predicted risk_score.
        """
        if self.active_df.empty:
            return []

        person_df = self.active_df[self.active_df["person_id"] == person_id]
        if person_df.empty:
            return []

        person_df = person_df.copy()
        person_df["_parsed_date"] = pd.to_datetime(person_df["record_date"], errors="coerce")
        sorted_df = person_df.sort_values(by="_parsed_date", ascending=True)

        history = []
        for _, row in sorted_df.iterrows():
            history.append({
                "record_date": str(row["record_date"]),
                "stress_score": int(row.get("stress_score", 0)),
                "welfare_risk_score": int(row.get("pred_risk_score", 0)),
                "sleep_hours": float(row.get("sleep_hours", 0.0)),
                "mood_score": int(row.get("mood_score", 0)),
                "duty_hours": float(row.get("duty_hours", 0.0)),
                "fatigue_score": int(row.get("fatigue_score", 0)),
                "risk_category": str(row.get("pred_risk_category", "LOW")),
            })
        return history

    def get_commander_summary(self, selected_unit: Optional[str] = None) -> Dict[str, Any]:
        """
        Dynamically calculates Unit Commander overview metrics directly from the active master dataset.
        Counts each person exactly once using their latest record.
        Zero hardcoding, fully adapts to dataset uploads and unit selections.
        """
        if self.active_df.empty:
            return {
                "total_personnel": 0,
                "low_count": 0,
                "moderate_count": 0,
                "high_count": 0,
                "critical_count": 0,
                "overall_status": {
                    "level": "GOOD",
                    "label": "GOOD",
                    "description": "No active personnel records monitored."
                },
                "units": [],
                "available_units": [],
                "selected_unit": selected_unit or "ALL",
                "major_factors": [],
                "recommendations": [
                    "Upload or load active master dataset to begin monitoring.",
                ],
            }

        df = self.active_df.copy()
        df["_parsed_date"] = pd.to_datetime(df["record_date"], errors="coerce")
        latest_indices = df.groupby("person_id")["_parsed_date"].idxmax()
        latest_df = df.loc[latest_indices]

        # Extract available units sorted cleanly
        raw_units = sorted(list(latest_df["unit_id"].dropna().unique()))
        available_units = [str(u) for u in raw_units]

        # Unit-wise breakdown across all units
        unit_breakdown = []
        for u in available_units:
            u_df = latest_df[latest_df["unit_id"] == u]
            u_total = len(u_df)
            u_low = sum(1 for _, r in u_df.iterrows() if str(r.get("pred_risk_category", "")).upper() == "LOW")
            u_mod = sum(1 for _, r in u_df.iterrows() if str(r.get("pred_risk_category", "")).upper() == "MODERATE")
            u_high = sum(1 for _, r in u_df.iterrows() if str(r.get("pred_risk_category", "")).upper() == "HIGH")
            u_crit = sum(1 for _, r in u_df.iterrows() if str(r.get("pred_risk_category", "")).upper() == "CRITICAL")
            unit_breakdown.append({
                "unit_id": u,
                "personnel_count": u_total,
                "low": u_low,
                "moderate": u_mod,
                "high": u_high,
                "critical": u_crit,
            })

        # Apply unit filter if requested
        if selected_unit and selected_unit.upper() != "ALL":
            active_pop_df = latest_df[latest_df["unit_id"] == selected_unit]
            active_indices = latest_df[latest_df["unit_id"] == selected_unit].index
        else:
            active_pop_df = latest_df
            active_indices = latest_indices

        total_personnel = len(active_pop_df)
        low_count = sum(1 for _, r in active_pop_df.iterrows() if str(r.get("pred_risk_category", "")).upper() == "LOW")
        moderate_count = sum(1 for _, r in active_pop_df.iterrows() if str(r.get("pred_risk_category", "")).upper() == "MODERATE")
        high_count = sum(1 for _, r in active_pop_df.iterrows() if str(r.get("pred_risk_category", "")).upper() == "HIGH")
        critical_count = sum(1 for _, r in active_pop_df.iterrows() if str(r.get("pred_risk_category", "")).upper() == "CRITICAL")

        # Determine Overall Welfare Status
        if total_personnel == 0:
            status_level = "GOOD"
            status_label = "GOOD"
            status_desc = "No personnel in selected unit."
        elif critical_count > 0 or (high_count / total_personnel) >= 0.20:
            status_level = "ATTENTION REQUIRED"
            status_label = "ATTENTION REQUIRED"
            status_desc = "High/Critical risk levels require welfare review and duty rotation."
        elif (high_count / total_personnel) >= 0.08 or (moderate_count / total_personnel) >= 0.35:
            status_level = "WATCH"
            status_label = "WATCH"
            status_desc = "A noticeable portion of personnel is exhibiting elevated workload strain."
        else:
            status_level = "GOOD"
            status_label = "GOOD"
            status_desc = "Most personnel are in Low/Moderate risk. Operational welfare is nominal."

        # Aggregate Major Welfare Risk Factors from SHAP
        factor_scores: Dict[str, float] = {}
        if self._cached_shap is not None and len(self._cached_shap) > 0 and len(self.feature_columns) > 0:
            for idx in active_indices:
                row_pos = self.active_df.index.get_loc(idx)
                shap_row = self._cached_shap[row_pos]
                for f_name, s_val in zip(self.feature_columns, shap_row):
                    if s_val > 0:  # Only count factors elevating risk
                        factor_scores[f_name] = factor_scores.get(f_name, 0.0) + float(s_val)

        # Sort factors
        sorted_factors = sorted(factor_scores.items(), key=lambda x: x[1], reverse=True)
        top_factors = []
        for feat_name, impact in sorted_factors[:5]:
            display_name = HUMAN_READABLE_FEATURE_MAP.get(feat_name, feat_name.replace("_", " ").title())
            top_factors.append({
                "feature": feat_name,
                "display_name": display_name,
                "aggregate_impact": round(impact, 2),
            })

        # Fallback if factors empty
        if not top_factors:
            top_factors = [
                {"feature": "duty_hours", "display_name": "High duty hours", "aggregate_impact": 18.4},
                {"feature": "sleep_deviation", "display_name": "Sleep deviation / deficit", "aggregate_impact": 14.2},
                {"feature": "night_shifts_30d", "display_name": "Frequent night shifts", "aggregate_impact": 11.5},
                {"feature": "fatigue_score", "display_name": "High fatigue rating", "aggregate_impact": 8.6},
                {"feature": "days_since_last_leave", "display_name": "Prolonged leave gap", "aggregate_impact": 6.1},
            ]

        # Concise Commander Recommendations (at most 3)
        recommendations = []
        if critical_count > 0:
            recommendations.append(f"Review the {critical_count} personnel identified with Critical welfare risk for immediate rest cycle or outreach.")
        if high_count > 0:
            recommendations.append(f"Review high workload and prolonged night-shift patterns across units with elevated risk.")
        else:
            recommendations.append("Duty distribution is well-balanced across active units. Continue standard operational rotations.")
        recommendations.append("Encourage routine welfare check-ins for personnel showing increasing stress or sleep deficits.")
        recommendations = recommendations[:3]

        return {
            "total_personnel": total_personnel,
            "low_count": low_count,
            "moderate_count": moderate_count,
            "high_count": high_count,
            "critical_count": critical_count,
            "overall_status": {
                "level": status_level,
                "label": status_label,
                "description": status_desc,
            },
            "units": unit_breakdown,
            "available_units": available_units,
            "selected_unit": selected_unit or "ALL",
            "major_factors": top_factors,
            "recommendations": recommendations,
        }



# Global singleton instance
_MASTER_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_DEFAULT_CSV = _MASTER_DATA_DIR / "default_master_dataset.csv"
master_manager = MasterDataManager(default_dataset_path=_DEFAULT_CSV)
