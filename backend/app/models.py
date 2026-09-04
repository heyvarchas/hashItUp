"""
ORM models for the Welfare Monitoring System MVP.

Two Postgres schemas, kept deliberately separate per the privacy design
in the architecture blueprint:

- `identity`  : who someone actually is (name, service number, unit, roles).
                Only this schema ever stores a person's real identity.
- `analytics` : everything HR/wellness/ML-related, keyed on `pseudonymous_id`
                only. No table in this schema stores a name, phone number,
                or address. The one deliberate cross-schema link is
                identity.personnel.pseudonymous_id <-> analytics.*.pseudonymous_id.

12 tables total, matching Section 3 of the MVP plan:
  identity:   personnel, units, user_roles                         (3)
  analytics:  duty_records, leave_records, deployments, transfers,
              training_records, wellness_assessments, risk_scores,
              recommendations, alerts, interventions                (9)
"""

import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    LargeBinary,
    Numeric,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.db import Base


# ---------------------------------------------------------------------------
# identity schema
# ---------------------------------------------------------------------------

class Unit(Base):
    __tablename__ = "units"
    __table_args__ = {"schema": "identity"}

    unit_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    unit_name = Column(String, nullable=False)

    personnel = relationship("Personnel", back_populates="unit")


class Personnel(Base):
    __tablename__ = "personnel"
    __table_args__ = {"schema": "identity"}

    person_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    service_number = Column(String, unique=True, nullable=False, index=True)
    name_enc = Column(LargeBinary, nullable=True)  # encrypted at write time, Phase 8+
    password_hash = Column(String, nullable=False)
    rank = Column(String, nullable=True)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("identity.units.unit_id"), nullable=True)

    # The ONLY key that ever appears in the analytics schema. The ML model,
    # risk engine, and dashboards join through this, never through person_id.
    pseudonymous_id = Column(UUID(as_uuid=True), unique=True, nullable=False, default=uuid.uuid4)

    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    unit = relationship("Unit", back_populates="personnel")
    roles = relationship("UserRole", back_populates="person")


class UserRole(Base):
    __tablename__ = "user_roles"
    __table_args__ = (
        CheckConstraint(
            "role IN ('personnel', 'welfare_officer', 'commander', 'admin')",
            name="ck_user_roles_role_valid",
        ),
        {"schema": "identity"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    person_id = Column(UUID(as_uuid=True), ForeignKey("identity.personnel.person_id"), nullable=False)
    role = Column(String, nullable=False)

    person = relationship("Personnel", back_populates="roles")


# ---------------------------------------------------------------------------
# analytics schema — every table below keys on pseudonymous_id ONLY.
# No name, phone number, or address may ever be added to this schema.
# ---------------------------------------------------------------------------

class DutyRecord(Base):
    __tablename__ = "duty_records"
    __table_args__ = (
        CheckConstraint(
            "shift_type IN ('day', 'night', 'extended')",
            name="ck_duty_records_shift_type_valid",
        ),
        {"schema": "analytics"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pseudonymous_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    record_date = Column(Date, nullable=False)
    shift_type = Column(String, nullable=False)
    duty_hours = Column(Numeric(4, 1), nullable=False)


class LeaveRecord(Base):
    __tablename__ = "leave_records"
    __table_args__ = {"schema": "analytics"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pseudonymous_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    leave_type = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)


class Deployment(Base):
    __tablename__ = "deployments"
    __table_args__ = (
        CheckConstraint(
            "hardship_level BETWEEN 1 AND 5", name="ck_deployments_hardship_level_range"
        ),
        {"schema": "analytics"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pseudonymous_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    deployment_type = Column(String, nullable=False)
    hardship_level = Column(SmallInteger, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)  # null = still active


class Transfer(Base):
    __tablename__ = "transfers"
    __table_args__ = {"schema": "analytics"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pseudonymous_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    transfer_date = Column(Date, nullable=False)


class TrainingRecord(Base):
    __tablename__ = "training_records"
    __table_args__ = {"schema": "analytics"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pseudonymous_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    training_date = Column(Date, nullable=False)
    hours_committed = Column(Numeric(5, 1), nullable=False)


class WellnessAssessment(Base):
    __tablename__ = "wellness_assessments"
    __table_args__ = (
        CheckConstraint("mood_score BETWEEN 1 AND 5", name="ck_wellness_mood_range"),
        CheckConstraint("sleep_quality_score BETWEEN 1 AND 5", name="ck_wellness_sleep_range"),
        CheckConstraint("stress_self_rating BETWEEN 1 AND 10", name="ck_wellness_stress_range"),
        {"schema": "analytics"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pseudonymous_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    mood_score = Column(SmallInteger, nullable=True)
    sleep_quality_score = Column(SmallInteger, nullable=True)
    stress_self_rating = Column(SmallInteger, nullable=True)
    help_requested = Column(Boolean, default=False, nullable=False)
    free_text_note_enc = Column(LargeBinary, nullable=True)


class RiskScore(Base):
    __tablename__ = "risk_scores"
    __table_args__ = (
        CheckConstraint("calibrated_score BETWEEN 0 AND 100", name="ck_risk_score_range"),
        CheckConstraint(
            "risk_category IN ('low', 'moderate', 'high', 'critical')",
            name="ck_risk_category_valid",
        ),
        {"schema": "analytics"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pseudonymous_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    computed_at = Column(DateTime(timezone=True), server_default=func.now())
    probability_score = Column(Numeric(5, 4), nullable=False)
    calibrated_score = Column(SmallInteger, nullable=False)
    risk_category = Column(String, nullable=False)
    contributing_factors = Column(JSONB, nullable=True)
    rule_flags = Column(JSONB, nullable=True)

    recommendations = relationship(
        "Recommendation",
        back_populates="risk_score",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    alerts = relationship(
        "Alert",
        back_populates="risk_score",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )



class Recommendation(Base):
    __tablename__ = "recommendations"
    __table_args__ = {"schema": "analytics"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    risk_score_id = Column(
        UUID(as_uuid=True), ForeignKey("analytics.risk_scores.id"), nullable=False
    )
    recommendation_type = Column(String, nullable=False)
    rationale = Column(Text, nullable=True)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())

    risk_score = relationship("RiskScore", back_populates="recommendations")


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (
        CheckConstraint(
            "severity IN ('info', 'moderate', 'high', 'critical')",
            name="ck_alerts_severity_valid",
        ),
        CheckConstraint(
            "status IN ('open', 'acknowledged', 'resolved')", name="ck_alerts_status_valid"
        ),
        {"schema": "analytics"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    risk_score_id = Column(
        UUID(as_uuid=True), ForeignKey("analytics.risk_scores.id"), nullable=False
    )
    severity = Column(String, nullable=False)
    status = Column(String, nullable=False, default="open")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    risk_score = relationship("RiskScore", back_populates="alerts")
    interventions = relationship("Intervention", back_populates="alert")


class Intervention(Base):
    __tablename__ = "interventions"
    __table_args__ = {"schema": "analytics"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alert_id = Column(UUID(as_uuid=True), ForeignKey("analytics.alerts.id"), nullable=False)
    # Deliberately NOT a cross-schema ForeignKey to identity.personnel:
    # this is the one narrow, auditable join point where a real officer's
    # identity touches analytics data. Kept as a plain UUID + app-level lookup
    # (via identity.personnel.person_id) so that join is always explicit
    # and logged, never an implicit database-level relationship.
    recorded_by_person_id = Column(UUID(as_uuid=True), nullable=False)
    intervention_type = Column(String, nullable=False)
    notes_enc = Column(LargeBinary, nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

    alert = relationship("Alert", back_populates="interventions")
