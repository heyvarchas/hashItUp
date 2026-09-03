"""
Phase 6.4: Risk Detail Endpoints Router.

Provides:
- GET /personnel/{pseudonymous_id}/risk (welfare_officer-only, clinical detail view)
- GET /risk/me (personnel-only, non-clinically/supportively framed self-view)
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.explainability import convert_to_supportive_factors
from app.jwt_auth import require_roles
from app.models import Personnel, RiskScore
from app.risk import compute_risk
from app.schemas import RiskScoreOut

router = APIRouter(tags=["Risk Detail"])


@router.get(
    "/personnel/{pseudonymous_id}/risk",
    response_model=RiskScoreOut,
    summary="Get Detailed Personnel Risk Assessment (Welfare Officers Only)",
    description=(
        "Retrieves the latest comprehensive risk score and clinical contributing factors "
        "for a specific personnel identified by their pseudonymous_id."
    ),
)
def get_personnel_risk_detail(
    pseudonymous_id: uuid.UUID,
    claims: dict = Depends(require_roles(["welfare_officer", "admin"])),
    db: Session = Depends(get_db),
):
    """
    Officer-facing endpoint to inspect a specific individual's risk score and clinical factors.
    """
    # 1. Fetch latest computed score for this pseudonymous_id
    latest_score = (
        db.query(RiskScore)
        .filter(RiskScore.pseudonymous_id == pseudonymous_id)
        .order_by(RiskScore.computed_at.desc())
        .first()
    )

    # 2. If no score exists yet, check if person exists and compute on the fly
    if not latest_score:
        person_exists = db.query(Personnel).filter(Personnel.pseudonymous_id == pseudonymous_id).first()
        if not person_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Personnel record with pseudonymous_id {pseudonymous_id} not found",
            )
        # Compute and persist
        res = compute_risk(pseudonymous_id, db=db, save_to_db=True)
        latest_score = db.query(RiskScore).filter(RiskScore.id == uuid.UUID(res["risk_score_id"])).first()

    return latest_score


@router.get(
    "/risk/me",
    response_model=RiskScoreOut,
    summary="Get My Wellness & Workload Risk Overview (Personnel)",
    description=(
        "Retrieves the caller's current risk assessment with non-clinical, supportive framing "
        "and actionable wellbeing recommendations."
    ),
)
def get_my_risk_overview(
    claims: dict = Depends(require_roles(["personnel"])),
    db: Session = Depends(get_db),
):
    """
    Personnel-facing endpoint to inspect self workload/wellness status.
    Uses supportive, non-alarming language for contributing factors.
    """
    caller_pseudonymous_id = claims.get("pseudonymous_id")
    if not caller_pseudonymous_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token missing pseudonymous_id claim",
        )

    pid_uuid = uuid.UUID(str(caller_pseudonymous_id))

    # 1. Fetch latest score
    latest_score = (
        db.query(RiskScore)
        .filter(RiskScore.pseudonymous_id == pid_uuid)
        .order_by(RiskScore.computed_at.desc())
        .first()
    )

    # 2. If no score exists yet, compute on the fly
    if not latest_score:
        res = compute_risk(pid_uuid, db=db, save_to_db=True)
        latest_score = db.query(RiskScore).filter(RiskScore.id == uuid.UUID(res["risk_score_id"])).first()

    # 3. Transform contributing factors into supportive wording
    raw_factors = list(latest_score.contributing_factors or [])
    supportive_factors = convert_to_supportive_factors(raw_factors)

    return RiskScoreOut(
        id=latest_score.id,
        pseudonymous_id=latest_score.pseudonymous_id,
        computed_at=latest_score.computed_at,
        probability_score=float(latest_score.probability_score),
        calibrated_score=int(latest_score.calibrated_score),
        risk_category=latest_score.risk_category,
        contributing_factors=supportive_factors,
        rule_flags=latest_score.rule_flags,
    )
