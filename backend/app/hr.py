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
