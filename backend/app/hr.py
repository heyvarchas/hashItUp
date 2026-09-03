"""
HR Router for the Welfare Monitoring System backend.
Provides endpoints for HR administrative actions and seeding.
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.jwt_auth import require_roles
from app.synthetic.seed_loader import seed_database, verify_database_seeding

router = APIRouter(prefix="/hr", tags=["HR / Administration"])


class SeedRequest(BaseModel):
    num_people: int = Field(default=500, ge=1, le=2000, description="Number of synthetic personnel to generate (500-1000 recommended)")
    months: int = Field(default=6, ge=1, le=18, description="Duration in months (1-18)")
    clear_existing: bool = Field(default=False, description="Whether to truncate tables before seeding")
    random_seed: int = Field(default=42, description="Random seed for reproducibility")


class SeedResponse(BaseModel):
    status: str
    message: str
    num_people: int
    months: int
    elapsed_seconds: float
    inserted_counts: Dict[str, int]
    verification: Dict[str, Any]


@router.post(
    "/seed",
    response_model=SeedResponse,
    summary="Seed Synthetic Population (Admin Only)",
    description="Generates and loads synthetic personnel, duty, leave, deployment, training, and wellness data into PostgreSQL.",
)
def seed_synthetic_data(
    payload: Optional[SeedRequest] = None,
    claims: dict = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
):
    """Admin-only endpoint to populate the database with synthetic data."""
    req = payload or SeedRequest()

    try:
        result = seed_database(
            db=db,
            num_people=req.num_people,
            months=req.months,
            random_seed=req.random_seed,
            clear_existing=req.clear_existing,
        )
        return SeedResponse(
            status="success",
            message=f"Successfully seeded {req.num_people} personnel and associated history into database.",
            num_people=req.num_people,
            months=req.months,
            elapsed_seconds=result["elapsed_seconds"],
            inserted_counts=result["inserted_counts"],
            verification=result["verification"],
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database seeding failed: {str(e)}",
        )


@router.get(
    "/seed/verify",
    summary="Verify Database Integrity (Admin Only)",
    description="Queries and verifies that all analytics tables resolve back to identity.personnel.",
)
def verify_seeding(
    claims: dict = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db),
):
    """Admin-only endpoint to verify pseudonymous linkages across schemas."""
    return verify_database_seeding(db)


@router.post(
    "/demo-persona/reset",
    summary="Reset Scripted Demo Persona (Admin / Welfare Officer)",
    description="Re-arms the Phase 10.1 scripted demo persona (CAPF-2024-001) to its pristine pre-demo state.",
)
def reset_demo_persona_endpoint(
    claims: dict = Depends(require_roles(["admin", "welfare_officer"])),
    db: Session = Depends(get_db),
):
    """Resets the scripted demo persona data to sit just below high threshold."""
    from app.synthetic.demo_persona import seed_demo_persona
    try:
        demo_info = seed_demo_persona(db)
        return {
            "status": "success",
            "message": "Scripted demo persona reset successfully to pristine baseline state.",
            "demo_persona": demo_info,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset demo persona: {str(e)}",
        )


@router.get(
    "/demo-persona",
    summary="Get Scripted Demo Persona Configuration",
    description="Returns public configuration details for the Phase 10.1 scripted demo persona.",
)
def get_demo_persona_endpoint(
    claims: dict = Depends(require_roles(["admin", "welfare_officer", "personnel"])),
    db: Session = Depends(get_db),
):
    """Returns the demo persona service credentials and pre-planned check-in parameters."""
    from app.synthetic.demo_persona import (
        DEMO_PERSONA_PASSWORD,
        DEMO_PERSONA_RANK,
        DEMO_PERSONA_ROLE,
        DEMO_PERSONA_SERVICE_NUMBER,
        DEMO_PERSONA_UNIT,
        PRE_PLANNED_WELLNESS_CHECKIN,
    )
    from app.models import Personnel, RiskScore, Alert

    person = db.query(Personnel).filter(Personnel.service_number == DEMO_PERSONA_SERVICE_NUMBER).first()
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Demo persona has not been seeded yet. Please run /hr/demo-persona/reset or /hr/seed.",
        )

    latest_score = (
        db.query(RiskScore)
        .filter(RiskScore.pseudonymous_id == person.pseudonymous_id)
        .order_by(RiskScore.computed_at.desc())
        .first()
    )

    open_alerts_count = (
        db.query(Alert)
        .join(RiskScore, Alert.risk_score_id == RiskScore.id)
        .filter(
            RiskScore.pseudonymous_id == person.pseudonymous_id,
            Alert.status == "open",
        )
        .count()
    )

    return {
        "service_number": DEMO_PERSONA_SERVICE_NUMBER,
        "password": DEMO_PERSONA_PASSWORD,
        "role": DEMO_PERSONA_ROLE,
        "rank": DEMO_PERSONA_RANK,
        "unit": DEMO_PERSONA_UNIT,
        "pseudonymous_id": str(person.pseudonymous_id),
        "latest_score": latest_score.calibrated_score if latest_score else None,
        "risk_category": latest_score.risk_category if latest_score else None,
        "open_alerts_count": open_alerts_count,
        "pre_planned_checkin": PRE_PLANNED_WELLNESS_CHECKIN,
    }
