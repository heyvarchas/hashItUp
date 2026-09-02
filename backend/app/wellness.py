"""
Wellness Router for the Welfare Monitoring System backend.
Provides endpoints for personnel wellness assessment submissions and history.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
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
