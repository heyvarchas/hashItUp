"""
Phase 7.3: Alerts Router.

Provides:
- GET /alerts (welfare_officer, admin only): Retrieves the triaged alert queue,
  filterable by status ('open', 'acknowledged', 'resolved') and severity ('critical', 'high', etc.),
  sorted chronologically by urgency (critical first, latest created).
"""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.jwt_auth import require_roles
from app.models import Alert, RiskScore
from app.schemas import AlertOut

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get(
    "",
    response_model=List[AlertOut],
    summary="Get Alert Queue (Welfare Officers / Admin)",
    description=(
        "Retrieves the welfare alert queue for triage. "
        "Allows filtering by alert status (e.g. 'open') and severity (e.g. 'critical', 'high'). "
        "Returns alert details enriched with calibrated risk scores and pseudonymous identifiers."
    ),
)
def get_alerts_queue(
    status_filter: Optional[str] = Query(
        default=None,
        alias="status",
        description="Filter by alert status: 'open', 'acknowledged', or 'resolved'",
    ),
    severity_filter: Optional[str] = Query(
        default=None,
        alias="severity",
        description="Filter by severity: 'critical', 'high', 'moderate', 'info'",
    ),
    limit: int = Query(default=100, ge=1, le=1000, description="Max number of alerts to return"),
    offset: int = Query(default=0, ge=0, description="Number of alerts to skip"),
    claims: dict = Depends(require_roles(["welfare_officer", "admin"])),
    db: Session = Depends(get_db),
):
    """
    Officer-facing endpoint to inspect active welfare alerts requiring attention.
    """
    query = (
        db.query(Alert, RiskScore)
        .join(RiskScore, Alert.risk_score_id == RiskScore.id)
    )

    if status_filter:
        query = query.filter(Alert.status == status_filter.lower())

    if severity_filter:
        query = query.filter(Alert.severity == severity_filter.lower())

    from sqlalchemy import case

    severity_order = case(
        (Alert.severity == "critical", 1),
        (Alert.severity == "high", 2),
        (Alert.severity == "moderate", 3),
        (Alert.severity == "info", 4),
        else_=5,
    )

    # Order by severity priority (critical first) then newest created
    results = (
        query.order_by(severity_order, Alert.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    alerts_out: List[AlertOut] = []
    for alert, score in results:
        alerts_out.append(
            AlertOut(
                id=alert.id,
                risk_score_id=alert.risk_score_id,
                severity=alert.severity,
                status=alert.status,
                created_at=alert.created_at,
                pseudonymous_id=score.pseudonymous_id,
                calibrated_score=int(score.calibrated_score) if score else None,
                risk_category=score.risk_category if score else None,
                contributing_factors=score.contributing_factors if score else None,
            )
        )

    return alerts_out


@router.get(
    "/{alert_id}",
    response_model=AlertOut,
    summary="Get Single Alert Details (Welfare Officers / Admin)",
    description="Retrieves a specific alert by alert_id enriched with risk score details.",
)
def get_alert_detail(
    alert_id: uuid.UUID,
    claims: dict = Depends(require_roles(["welfare_officer", "admin"])),
    db: Session = Depends(get_db),
):
    """
    Officer-facing endpoint to inspect a specific alert by its ID.
    """
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with ID {alert_id} not found",
        )

    score = alert.risk_score
    return AlertOut(
        id=alert.id,
        risk_score_id=alert.risk_score_id,
        severity=alert.severity,
        status=alert.status,
        created_at=alert.created_at,
        pseudonymous_id=score.pseudonymous_id if score else None,
        calibrated_score=int(score.calibrated_score) if score else None,
        risk_category=score.risk_category if score else None,
        contributing_factors=score.contributing_factors if score else None,
    )
