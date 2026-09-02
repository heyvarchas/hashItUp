"""
Throwaway verification script for Task 1.3.

Not part of the application — this is a one-off script proving the
acceptance check from the MVP checklist:

    "a throwaway script can insert and read back one row in each of
    the four tables (Personnel, WellnessAssessment, RiskScore, Alert)
    through the ORM."

Run it with:
    docker compose exec backend python -m app.scratch.verify_models
or locally (with DATABASE_URL pointed at your dev DB):
    python -m app.scratch.verify_models

Everything it writes is rolled back at the end — it never leaves test
data behind in the database.

Safe to delete once Task 1.3 is checked off; it exists purely to prove
the models/schemas work, not as a permanent fixture.
"""

from app.db import SessionLocal
from app.models import Alert, Personnel, RiskScore, Unit, WellnessAssessment
from app.schemas import AlertOut, PersonnelOut, RiskScoreOut, WellnessAssessmentOut


def main() -> None:
    db = SessionLocal()

    try:
        # --- Unit + Personnel -------------------------------------------------
        unit = Unit(unit_name="Verification Test Battalion")
        db.add(unit)
        db.flush()

        person = Personnel(
            service_number="CAPF-VERIFY-001",
            password_hash="not-a-real-hash-this-is-a-test",
            rank="Constable",
            unit_id=unit.unit_id,
        )
        db.add(person)
        db.flush()

        personnel_out = PersonnelOut.model_validate(person)
        print("[1/4] Personnel   — inserted + read back:", personnel_out.service_number)

        # --- WellnessAssessment --------------------------------------------------
        wellness = WellnessAssessment(
            pseudonymous_id=person.pseudonymous_id,
            mood_score=2,
            sleep_quality_score=2,
            stress_self_rating=7,
            help_requested=False,
        )
        db.add(wellness)
        db.flush()

        wellness_out = WellnessAssessmentOut.model_validate(wellness)
        print("[2/4] Wellness    — inserted + read back: stress_self_rating =", wellness_out.stress_self_rating)

        # --- RiskScore -----------------------------------------------------------
        # Not a real model prediction — Phase 5/6 build that. Here we're only
        # proving the table + schema round-trip, so the numbers are placeholders.
        risk = RiskScore(
            pseudonymous_id=person.pseudonymous_id,
            probability_score=0.62,
            calibrated_score=62,
            risk_category="moderate",
            contributing_factors=["placeholder: real values arrive in Phase 6"],
            rule_flags={},
        )
        db.add(risk)
        db.flush()

        risk_out = RiskScoreOut.model_validate(risk)
        print("[3/4] RiskScore   — inserted + read back: risk_category =", risk_out.risk_category)

        # --- Alert -----------------------------------------------------------------
        alert = Alert(
            risk_score_id=risk.id,
            severity="moderate",
            status="open",
        )
        db.add(alert)
        db.flush()

        alert_out = AlertOut.model_validate(alert)
        print("[4/4] Alert       — inserted + read back: status =", alert_out.status)

        print("\nAll four tables round-tripped successfully through the ORM and Pydantic schemas.")

    finally:
        # Never persist test data — this script is verification-only.
        db.rollback()
        db.close()
        print("Rolled back — no test data left in the database.")


if __name__ == "__main__":
    main()