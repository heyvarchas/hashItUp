"""
Wellness Router for the Welfare Monitoring System backend.
Provides endpoints for personnel wellness assessment submissions and history.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.jwt_auth import require_roles
from app.models import WellnessAssessment
from app.schemas import WellnessAssessmentCreate, WellnessAssessmentOut

router = APIRouter(prefix="/wellness", tags=["wellness"])


@router.post(
    "/assessment",
    response_model=WellnessAssessmentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Submit Wellness Assessment (Personnel Only)",
    description=(
        "Submits a wellness self-assessment for the logged-in personnel user. "
        "The assessment is automatically linked to the user's pseudonymous_id extracted from their JWT."
    ),
)
def submit_wellness_assessment(
    payload: WellnessAssessmentCreate,
    claims: dict = Depends(require_roles(["personnel"])),
    db: Session = Depends(get_db),
):
    """
    Personnel-only endpoint to submit a daily/periodic wellness assessment.
    Validates score ranges and binds the submission to the caller's pseudonymous_id.
    """
    caller_pseudonymous_id = claims.get("pseudonymous_id")
    if not caller_pseudonymous_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token missing pseudonymous_id claim",
        )

    free_text_enc = payload.free_text_note.encode("utf-8") if payload.free_text_note else None

    assessment = WellnessAssessment(
        id=uuid.uuid4(),
        pseudonymous_id=uuid.UUID(str(caller_pseudonymous_id)),
        submitted_at=datetime.now(timezone.utc),
        mood_score=payload.mood_score,
        sleep_quality_score=payload.sleep_quality_score,
        stress_self_rating=payload.stress_self_rating,
        help_requested=payload.help_requested,
        free_text_note_enc=free_text_enc,
    )

    try:
        db.add(assessment)
        db.commit()
        db.refresh(assessment)
        return assessment
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit wellness assessment: {str(e)}",
        )


@router.get(
    "/history",
    response_model=List[WellnessAssessmentOut],
    summary="Get Wellness Assessment History",
    description=(
        "Retrieves wellness assessment history. "
        "Personnel can only view their own history. "
        "Welfare officers can query any user's history by supplying a pseudonymous_id query parameter."
    ),
)
def get_wellness_history(
    pseudonymous_id: Optional[uuid.UUID] = Query(
        default=None,
        description="Pseudonymous ID of personnel to fetch history for (welfare_officer/admin only)",
    ),
    limit: int = Query(default=100, ge=1, le=1000, description="Max number of records to return"),
    offset: int = Query(default=0, ge=0, description="Number of records to skip"),
    claims: dict = Depends(require_roles(["personnel", "welfare_officer", "admin"])),
    db: Session = Depends(get_db),
):
    """
    Retrieve history of wellness assessments.
    - Personnel: strictly limited to their own pseudonymous_id from JWT. If a different pseudonymous_id is passed, returns 403 Forbidden.
    - Welfare Officer / Admin: can supply pseudonymous_id to inspect any specific personnel, or retrieve without filter up to limit.
    """
    user_role = claims.get("role")
    caller_pseudonymous_id = claims.get("pseudonymous_id")

    query = db.query(WellnessAssessment)

    if user_role == "personnel":
        if not caller_pseudonymous_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token missing pseudonymous_id claim",
            )
        # Reject if personnel attempts to inspect someone else's ID
        if pseudonymous_id is not None and str(pseudonymous_id) != str(caller_pseudonymous_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Personnel are not permitted to view wellness history for other users",
            )
        target_id = uuid.UUID(str(caller_pseudonymous_id))
        query = query.filter(WellnessAssessment.pseudonymous_id == target_id)
    else:
        # Welfare officer or admin
        if pseudonymous_id is not None:
            query = query.filter(WellnessAssessment.pseudonymous_id == pseudonymous_id)

    assessments = (
        query.order_by(WellnessAssessment.submitted_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return assessments
