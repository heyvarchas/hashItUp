"""
Phase 9.2: Interventions Router.

Provides:
- POST /interventions (welfare_officer, admin only):
  Records a supportive or clinical intervention against an active alert,
  and updates the alert status (e.g. from 'open' to 'resolved' or 'acknowledged').
- GET /interventions (welfare_officer, admin only):
  Retrieves recorded intervention history, filterable by alert_id or pseudonymous_id.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.jwt_auth import require_roles
from app.models import Alert, Intervention, RiskScore
from app.schemas import InterventionCreate, InterventionOut

router = APIRouter(prefix="/interventions", tags=["Interventions"])


@router.post(
    "",
    response_model=InterventionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Record Welfare Intervention (Welfare Officers / Admin)",
    description=(
        "Records a clinical or operational intervention against an alert. "
        "Automatically updates the target alert's triage status (e.g. 'resolved' or 'acknowledged') "
        "and binds the action to the officer's person_id for auditability."
    ),
)
def record_intervention(
    payload: InterventionCreate,
    claims: dict = Depends(require_roles(["welfare_officer", "admin"])),
    db: Session = Depends(get_db),
):
    """
    Officer-facing endpoint to document an intervention and resolve or acknowledge an alert.
    """
    # 1. Validate Alert existence
    alert = db.query(Alert).filter(Alert.id == payload.alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with ID {payload.alert_id} not found",
        )

    # 2. Extract officer identity from JWT
    officer_person_id_str = claims.get("person_id")
    if not officer_person_id_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token missing person_id claim",
        )
    officer_person_id = uuid.UUID(str(officer_person_id_str))

    # 3. Validate new status
    target_status = (payload.new_alert_status or "resolved").strip().lower()
    valid_statuses = {"open", "acknowledged", "resolved"}
    if target_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid alert status '{target_status}'. Must be one of: {', '.join(valid_statuses)}",
        )

    # 4. Prepare encrypted notes bytes
    notes_enc = payload.notes.encode("utf-8") if payload.notes else None

    # 5. Create Intervention & update Alert status
    intervention = Intervention(
        id=uuid.uuid4(),
        alert_id=alert.id,
        recorded_by_person_id=officer_person_id,
        intervention_type=payload.intervention_type.strip(),
        notes_enc=notes_enc,
        recorded_at=datetime.now(timezone.utc),
    )

    alert.status = target_status

    try:
        db.add(intervention)
        db.commit()
        db.refresh(intervention)
        db.refresh(alert)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record intervention: {str(e)}",
        )

    return InterventionOut(
        id=intervention.id,
        alert_id=intervention.alert_id,
        recorded_by_person_id=intervention.recorded_by_person_id,
        intervention_type=intervention.intervention_type,
        notes=payload.notes,
        recorded_at=intervention.recorded_at,
        alert_status=alert.status,
    )


@router.get(
    "",
    response_model=List[InterventionOut],
    summary="Get Recorded Interventions",
    description="Retrieves a list of interventions filtered by alert_id or pseudonymous_id.",
)
def get_interventions(
    alert_id: Optional[uuid.UUID] = Query(default=None, description="Filter by alert ID"),
    pseudonymous_id: Optional[uuid.UUID] = Query(
        default=None, description="Filter by pseudonymous ID of personnel"
    ),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    claims: dict = Depends(require_roles(["welfare_officer", "admin"])),
    db: Session = Depends(get_db),
):
    """
    Officer-facing endpoint to inspect past intervention logs.
    """
    query = (
        db.query(Intervention, Alert)
        .join(Alert, Intervention.alert_id == Alert.id)
    )

    if alert_id:
        query = query.filter(Intervention.alert_id == alert_id)

    if pseudonymous_id:
        query = query.join(RiskScore, Alert.risk_score_id == RiskScore.id).filter(
            RiskScore.pseudonymous_id == pseudonymous_id
        )

    results = (
        query.order_by(Intervention.recorded_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    output: List[InterventionOut] = []
    for intervention, alert in results:
        notes_str = None
        if intervention.notes_enc:
            try:
                notes_str = intervention.notes_enc.decode("utf-8")
            except Exception:
                notes_str = "<Encrypted note>"

        output.append(
            InterventionOut(
                id=intervention.id,
                alert_id=intervention.alert_id,
                recorded_by_person_id=intervention.recorded_by_person_id,
                intervention_type=intervention.intervention_type,
                notes=notes_str,
                recorded_at=intervention.recorded_at,
                alert_status=alert.status,
            )
        )

    return output
