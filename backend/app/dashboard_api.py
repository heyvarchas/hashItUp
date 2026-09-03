"""
Phase 9.3: Dashboard API Router.

Provides:
- GET /dashboard/unit-summary (welfare_officer, admin only):
  Computes and returns aggregate-only statistical distributions of risk categories,
  average calibrated stress scores, and alert totals across the monitored population.
  Strictly privacy-preserving: contains ZERO individual-level identifiers or PII.
"""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.jwt_auth import require_roles
from app.models import Alert, RiskScore
from app.schemas import RiskCategoryStat, UnitSummaryOut

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get(
    "/unit-summary",
    response_model=UnitSummaryOut,
    summary="Get Unit Population Risk Summary (Welfare Officers / Admin)",
    description=(
        "Retrieves aggregate-only population distribution metrics across the four risk categories "
        "(low, moderate, high, critical), average calibrated risk score, and alert counts. "
        "Strictly privacy-preserving with no individual records or pseudonyms."
    ),
)
def get_unit_summary(
    claims: dict = Depends(require_roles(["welfare_officer", "admin"])),
    db: Session = Depends(get_db),
):
    """
    Officer-facing endpoint to view aggregated population risk distributions without individual drill-down.
    """
    # 1. Fetch latest risk score per distinct pseudonymous_id
    subq = (
        db.query(
            RiskScore.pseudonymous_id,
            func.max(RiskScore.computed_at).label("max_computed_at"),
        )
        .group_by(RiskScore.pseudonymous_id)
        .subquery()
    )

    latest_scores = (
        db.query(RiskScore)
        .join(
            subq,
            (RiskScore.pseudonymous_id == subq.c.pseudonymous_id)
            & (RiskScore.computed_at == subq.c.max_computed_at),
        )
        .all()
    )

    total_personnel = len(latest_scores)

    # 2. Count risk categories
    low_count = sum(1 for s in latest_scores if s.risk_category == "low")
    moderate_count = sum(1 for s in latest_scores if s.risk_category == "moderate")
    high_count = sum(1 for s in latest_scores if s.risk_category == "high")
    critical_count = sum(1 for s in latest_scores if s.risk_category == "critical")

    # 3. Percentages & averages
    low_pct = round((low_count / total_personnel) * 100, 1) if total_personnel > 0 else 0.0
    moderate_pct = round((moderate_count / total_personnel) * 100, 1) if total_personnel > 0 else 0.0
    high_pct = round((high_count / total_personnel) * 100, 1) if total_personnel > 0 else 0.0
    critical_pct = round((critical_count / total_personnel) * 100, 1) if total_personnel > 0 else 0.0

    avg_score = (
        round(sum(float(s.calibrated_score) for s in latest_scores) / total_personnel, 1)
        if total_personnel > 0
        else 0.0
    )

    distribution: List[RiskCategoryStat] = [
        RiskCategoryStat(
            category="low",
            label="Low Risk",
            count=low_count,
            percentage=low_pct,
            color="#10b981",  # Emerald
        ),
        RiskCategoryStat(
            category="moderate",
            label="Moderate Risk",
            count=moderate_count,
            percentage=moderate_pct,
            color="#3b82f6",  # Blue
        ),
        RiskCategoryStat(
            category="high",
            label="High Risk",
            count=high_count,
            percentage=high_pct,
            color="#f59e0b",  # Amber
        ),
        RiskCategoryStat(
            category="critical",
            label="Critical Urgency",
            count=critical_count,
            percentage=critical_pct,
            color="#f43f5e",  # Rose
        ),
    ]

    # 4. Count open and acknowledged alerts
    open_alerts = (
        db.query(func.count(Alert.id))
        .filter(Alert.status == "open")
        .scalar()
        or 0
    )
    acknowledged_alerts = (
        db.query(func.count(Alert.id))
        .filter(Alert.status == "acknowledged")
        .scalar()
        or 0
    )

    return UnitSummaryOut(
        total_personnel=total_personnel,
        average_calibrated_score=avg_score,
        distribution=distribution,
        critical_count=critical_count,
        high_count=high_count,
        moderate_count=moderate_count,
        low_count=low_count,
        open_alerts_count=open_alerts,
        acknowledged_alerts_count=acknowledged_alerts,
    )
