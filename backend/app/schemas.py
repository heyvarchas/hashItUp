"""
Pydantic schemas — request/response shapes for the API.

These are deliberately separate from app/models.py (the SQLAlchemy ORM
models). Models describe what's stored in the database; schemas describe
what's allowed in/out over HTTP. Keeping them separate means, for example,
that `password_hash` can exist on the Personnel model but never
accidentally get serialized into an API response, and that a client can
never pass a `pseudonymous_id` of their own choosing into a request body.

Scope for Task 1.3: schemas for the four entities the next few phases
actually touch first — Personnel, WellnessAssessment, RiskScore, Alert.
Schemas for Recommendation/Intervention/etc. get added in the phases
that build their endpoints (7, 9), not before, per the "don't build
ahead of the task at hand" rule from the MVP plan.
"""

import uuid
from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Personnel
# ---------------------------------------------------------------------------

class PersonnelCreate(BaseModel):
    """Input for creating a personnel account (used by the seed script / admin creation in 2.1)."""

    service_number: str
    password: str = Field(min_length=8)
    rank: Optional[str] = None
    unit_id: Optional[uuid.UUID] = None


class PersonnelOut(BaseModel):
    """
    What's safe to return about a personnel record over the API.
    Notably absent: password_hash, name_enc (raw encrypted bytes are
    never serialized directly — a decrypted display name, if ever
    needed, would be a separate explicit field added later, not this).
    """

    model_config = ConfigDict(from_attributes=True)

    person_id: uuid.UUID
    service_number: str
    rank: Optional[str] = None
    unit_id: Optional[uuid.UUID] = None
    pseudonymous_id: uuid.UUID
    active: bool
    created_at: datetime


# ---------------------------------------------------------------------------
# Wellness Assessments
# ---------------------------------------------------------------------------

class WellnessAssessmentCreate(BaseModel):
    """
    Input for POST /wellness/assessment (built in Task 4.1).
    Deliberately has NO pseudonymous_id field — the server always takes
    that from the caller's own JWT, never from the request body, so a
    personnel user can never submit an assessment under someone else's
    identity even by accident.
    """

    mood_score: Optional[int] = Field(default=None, ge=1, le=5)
    sleep_quality_score: Optional[int] = Field(default=None, ge=1, le=5)
    stress_self_rating: Optional[int] = Field(default=None, ge=1, le=10)
    help_requested: bool = False
    free_text_note: Optional[str] = None  # encrypted at the DB-write step, not here


class WellnessAssessmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    pseudonymous_id: uuid.UUID
    submitted_at: datetime
    mood_score: Optional[int] = None
    sleep_quality_score: Optional[int] = None
    stress_self_rating: Optional[int] = None
    help_requested: bool
    # free_text_note_enc intentionally excluded — raw encrypted bytes have
    # no business being serialized into a JSON API response.


# ---------------------------------------------------------------------------
# Risk Scores
# ---------------------------------------------------------------------------

class RiskScoreOut(BaseModel):
    """
    Output for GET /risk/me and GET /personnel/{pseudonymous_id}/risk
    (Task 6.4). Same schema serves both endpoints for now; if the
    personnel-facing "supportive framing" text diverges enough from the
    welfare-officer-facing detail view, split this into two schemas then
    rather than pre-building that distinction now.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    pseudonymous_id: uuid.UUID
    computed_at: datetime
    probability_score: float
    calibrated_score: int = Field(ge=0, le=100)
    risk_category: str
    contributing_factors: Optional[list[Any]] = None
    rule_flags: Optional[dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    risk_score_id: uuid.UUID
    severity: str
    status: str
    created_at: datetime