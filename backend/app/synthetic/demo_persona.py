"""
Phase 10.1: Scripted Demo Persona.

Defines and provisions the designated scripted demo persona:
- Service Number : CAPF-2024-001 (and DEMO-PERSONNEL-001 alias)
- Password       : password123 (Argon2 hashed)
- Role           : personnel
- Rank           : Havildar
- Unit           : 1st Battalion Infantry

Baseline characteristics:
- Seeded data intentionally sits just below the "high" threshold (calibrated score in 'moderate' tier, no open alerts).
- Baseline includes heavy duty tempo, 95 days since last leave, stable prior check-ins with mood=4.
- Live check-in submission with pre-planned inputs (mood=1, sleep=1, stress=9) immediately trips the sudden wellness drop rule (mood drop >= 2 pts), escalating risk score >= 65 (high tier) and generating a new open alert.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import (
    Alert,
    DutyRecord,
    Intervention,
    LeaveRecord,
    Personnel,
    Recommendation,
    RiskScore,
    TrainingRecord,
    Unit,
    UserRole,
    WellnessAssessment,
)
from app.risk import compute_risk
from app.security import hash_password

DEMO_PERSONA_SERVICE_NUMBER = "CAPF-2024-001"
DEMO_PERSONA_PASSWORD = "password123"
DEMO_PERSONA_RANK = "Havildar"
DEMO_PERSONA_UNIT = "1st Battalion Infantry"
DEMO_PERSONA_ROLE = "personnel"

PRE_PLANNED_WELLNESS_CHECKIN = {
    "mood_score": 1,
    "sleep_quality_score": 1,
    "stress_self_rating": 9,
    "help_requested": False,
    "free_text_note": "Severe exhaustion, chronic sleep disturbance and feeling unable to cope.",
}


def get_or_create_demo_unit(db: Session, unit_name: str = DEMO_PERSONA_UNIT) -> Unit:
    """Retrieves or creates the demo battalion unit."""
    unit = db.query(Unit).filter(Unit.unit_name == unit_name).first()
    if not unit:
        unit = Unit(unit_id=uuid.uuid4(), unit_name=unit_name)
        db.add(unit)
        db.flush()
    return unit



def seed_demo_persona(
    db: Session,
    service_number: str = DEMO_PERSONA_SERVICE_NUMBER,
    password: str = DEMO_PERSONA_PASSWORD,
    as_of_date: Optional[datetime.date] = None,
) -> Dict[str, Any]:
    """
    Seeds or resets the designated demo persona in identity and analytics schemas.

    Configures:
    1. identity.personnel record with hashed password and 'personnel' role.
    2. Cleaned historical analytics for this persona.
    3. Realistic 60-day duty history with extended and night shifts.
    4. Leave record ending 95 days ago (moderate baseline risk trigger).
    5. Weekly training sessions.
    6. 3 prior wellness check-ins (mood=4, stress=5-6, sleep=2-3, no sudden drop).
    7. Baseline risk scoring: category is strictly 'moderate' with 0 open alerts.
    """
    today = as_of_date or datetime.date.today()
    unit = get_or_create_demo_unit(db)

    # 1. Identity Account
    person = db.query(Personnel).filter(Personnel.service_number == service_number).first()
    if not person:
        person_id = uuid.uuid4()
        pseudonymous_id = uuid.uuid4()
        person = Personnel(
            person_id=person_id,
            service_number=service_number,
            password_hash=hash_password(password),
            rank=DEMO_PERSONA_RANK,
            unit_id=unit.unit_id,
            pseudonymous_id=pseudonymous_id,
            active=True,
            created_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=180),
        )
        db.add(person)
        db.flush()

        user_role = UserRole(person_id=person.person_id, role=DEMO_PERSONA_ROLE)
        db.add(user_role)
        db.flush()
    else:
        person.password_hash = hash_password(password)
        person.active = True
        person.unit_id = unit.unit_id
        db.flush()

    # 1.1 Also ensure demo Welfare Officer and Admin accounts exist for the walkthrough
    _ensure_officer_and_admin_accounts(db, unit.unit_id)

    pid = person.pseudonymous_id

    # 2. Clean existing analytics data for this persona in correct FK order
    score_ids = [s.id for s in db.query(RiskScore.id).filter(RiskScore.pseudonymous_id == pid).all()]
    if score_ids:
        alert_ids = [a.id for a in db.query(Alert.id).filter(Alert.risk_score_id.in_(score_ids)).all()]
        if alert_ids:
            db.query(Intervention).filter(Intervention.alert_id.in_(alert_ids)).delete(synchronize_session=False)
        db.query(Alert).filter(Alert.risk_score_id.in_(score_ids)).delete(synchronize_session=False)
        db.query(Recommendation).filter(Recommendation.risk_score_id.in_(score_ids)).delete(synchronize_session=False)
        db.query(RiskScore).filter(RiskScore.id.in_(score_ids)).delete(synchronize_session=False)

    db.query(WellnessAssessment).filter(WellnessAssessment.pseudonymous_id == pid).delete(synchronize_session=False)
    db.query(DutyRecord).filter(DutyRecord.pseudonymous_id == pid).delete(synchronize_session=False)
    db.query(LeaveRecord).filter(LeaveRecord.pseudonymous_id == pid).delete(synchronize_session=False)
    db.query(TrainingRecord).filter(TrainingRecord.pseudonymous_id == pid).delete(synchronize_session=False)
    db.commit()

    # 3. Leave Record: Last leave ended 95 days ago -> places persona in moderate baseline
    leave = LeaveRecord(
        id=uuid.uuid4(),
        pseudonymous_id=pid,
        leave_type="annual",
        start_date=today - datetime.timedelta(days=105),
        end_date=today - datetime.timedelta(days=95),
    )
    db.add(leave)

    # 4. Duty Records: High demanding duty tempo over 60 days
    for i in range(1, 60):
        d = today - datetime.timedelta(days=i)
        if i in (1, 2, 3):
            st = "night"
            hours = 12.0
        elif i in (8, 9, 10, 15, 16):
            st = "extended"
            hours = 14.0
        elif d.weekday() == 6 and i > 14:
            continue
        else:
            st = "day"
            hours = 10.0

        db.add(DutyRecord(
            id=uuid.uuid4(),
            pseudonymous_id=pid,
            record_date=d,
            shift_type=st,
            duty_hours=hours,
        ))

    # 5. Training Records
    for i in (5, 12, 19, 26):
        db.add(TrainingRecord(
            id=uuid.uuid4(),
            pseudonymous_id=pid,
            training_date=today - datetime.timedelta(days=i),
            hours_committed=6.0,
        ))

    # 6. Baseline Wellness History: 3 submissions showing stable mood (mood=4)
    # 20 days ago
    db.add(WellnessAssessment(
        id=uuid.uuid4(),
        pseudonymous_id=pid,
        submitted_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=20),
        mood_score=4,
        sleep_quality_score=3,
        stress_self_rating=5,
        help_requested=False,
        free_text_note_enc="Duty is heavy but holding up.".encode("utf-8"),
    ))
    # 10 days ago
    db.add(WellnessAssessment(
        id=uuid.uuid4(),
        pseudonymous_id=pid,
        submitted_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=10),
        mood_score=4,
        sleep_quality_score=3,
        stress_self_rating=6,
        help_requested=False,
        free_text_note_enc="Consecutive night rotations starting to wear on me.".encode("utf-8"),
    ))
    # 2 days ago (most recent prior check-in)
    db.add(WellnessAssessment(
        id=uuid.uuid4(),
        pseudonymous_id=pid,
        submitted_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=2),
        mood_score=4,
        sleep_quality_score=2,
        stress_self_rating=6,
        help_requested=False,
        free_text_note_enc="Fatigued from night rotation, managing for now.".encode("utf-8"),
    ))

    db.commit()

    # 7. Compute Baseline Risk Score (Synchronous)
    baseline_risk = compute_risk(pid, db=db, save_to_db=True)

    # 8. Sanity check baseline invariants
    open_alerts_count = (
        db.query(Alert)
        .join(RiskScore, Alert.risk_score_id == RiskScore.id)
        .filter(
            RiskScore.pseudonymous_id == pid,
            Alert.status == "open",
        )
        .count()
    )

    return {
        "service_number": person.service_number,
        "person_id": str(person.person_id),
        "pseudonymous_id": str(person.pseudonymous_id),
        "rank": person.rank,
        "role": DEMO_PERSONA_ROLE,
        "baseline_score": baseline_risk["calibrated_score"],
        "baseline_category": baseline_risk["risk_category"],
        "baseline_open_alerts": open_alerts_count,
        "pre_planned_checkin": PRE_PLANNED_WELLNESS_CHECKIN,
    }


def reset_demo_persona(db: Optional[Session] = None) -> Dict[str, Any]:
    """Re-arms the demo persona to its pristine pre-demo state."""
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True
    try:
        return seed_demo_persona(db)
    finally:
        if own_session:
            db.close()


def _ensure_officer_and_admin_accounts(db: Session, unit_id: Optional[uuid.UUID] = None) -> None:
    """Ensures standard demo welfare officer and admin accounts exist with known credentials."""
    # 1. Welfare Officer
    officer_sn = "CAPF-2024-002"
    officer = db.query(Personnel).filter(Personnel.service_number == officer_sn).first()
    if not officer:
        officer = Personnel(
            person_id=uuid.uuid4(),
            service_number=officer_sn,
            password_hash=hash_password("password456"),
            rank="Inspector",
            unit_id=unit_id,
            pseudonymous_id=uuid.uuid4(),
            active=True,
            created_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=180),
        )
        db.add(officer)
        db.flush()
        db.add(UserRole(person_id=officer.person_id, role="welfare_officer"))
        db.flush()
    else:
        officer.password_hash = hash_password("password456")
        officer.active = True
        # Ensure role is welfare_officer
        role_record = db.query(UserRole).filter(UserRole.person_id == officer.person_id).first()
        if role_record:
            role_record.role = "welfare_officer"
        else:
            db.add(UserRole(person_id=officer.person_id, role="welfare_officer"))
        db.flush()

    # 2. Administrator
    admin_sn = "ADMIN-001"
    admin = db.query(Personnel).filter(Personnel.service_number == admin_sn).first()
    if not admin:
        admin = Personnel(
            person_id=uuid.uuid4(),
            service_number=admin_sn,
            password_hash=hash_password("admin123"),
            rank="Colonel",
            unit_id=unit_id,
            pseudonymous_id=uuid.uuid4(),
            active=True,
            created_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=180),
        )
        db.add(admin)
        db.flush()
        db.add(UserRole(person_id=admin.person_id, role="admin"))
        db.flush()
    else:
        admin.password_hash = hash_password("admin123")
        admin.active = True
        role_record = db.query(UserRole).filter(UserRole.person_id == admin.person_id).first()
        if role_record:
            role_record.role = "admin"
        else:
            db.add(UserRole(person_id=admin.person_id, role="admin"))
        db.flush()
