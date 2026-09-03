"""
Unit and integration tests for Phase 6.3: Scoring on Data Writes.

Verifies:
1. Every successful `POST /wellness/assessment` immediately and synchronously
   triggers `compute_risk()` and writes a new row to `analytics.risk_scores`.
2. History is strictly preserved (submitting multiple assessments adds new rows without overwriting).
3. The generated `risk_scores` row contains accurate calibrated scores, risk categories,
   rule_flags, and plain-language contributing_factors.
4. Submitting an assessment with `help_requested=True` immediately produces a new `risk_scores`
   row forced to 'critical' severity tier.
5. HR seeding via `POST /hr/seed` computes and persists initial risk scores for all seeded personnel.
"""

import datetime
import unittest
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import SessionLocal
from app.jwt_auth import create_access_token
from app.main import app
from app.models import Personnel, RiskScore, WellnessAssessment


class TestScoringOnDataWrites(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()

        # Create test personnel
        cls.test_sn = f"SN-WRITE-{uuid.uuid4().hex[:6].upper()}"
        cls.test_pid = uuid.uuid4()
        cls.test_person_id = uuid.uuid4()

        cls.person = Personnel(
            person_id=cls.test_person_id,
            service_number=cls.test_sn,
            password_hash="test_hash",
            pseudonymous_id=cls.test_pid,
            active=True,
        )
        cls.db.add(cls.person)
        cls.db.commit()

        cls.personnel_token = create_access_token(
            person_id=str(cls.test_person_id),
            pseudonymous_id=str(cls.test_pid),
            role="personnel",
        )

        cls.admin_token = create_access_token(
            person_id=str(uuid.uuid4()),
            pseudonymous_id=str(uuid.uuid4()),
            role="admin",
        )

    @classmethod
    def tearDownClass(cls):
        cls.db.execute(text("DELETE FROM analytics.risk_scores WHERE pseudonymous_id = :pid"), {"pid": cls.test_pid})
        cls.db.execute(text("DELETE FROM analytics.wellness_assessments WHERE pseudonymous_id = :pid"), {"pid": cls.test_pid})
        cls.db.execute(text("DELETE FROM identity.personnel WHERE pseudonymous_id = :pid"), {"pid": cls.test_pid})
        cls.db.commit()
        cls.db.close()

    def test_assessment_submission_triggers_synchronous_risk_scoring(self):
        """
        Phase 6.3 Done When:
        Submitting a wellness assessment via the API immediately produces a new visible row
        in risk_scores with an accurate contributing_factors payload, within the same HTTP
        response cycle.
        """
        # Count existing risk scores for this user
        initial_count = (
            self.db.query(RiskScore)
            .filter(RiskScore.pseudonymous_id == self.test_pid)
            .count()
        )

        # Submit wellness assessment via POST /wellness/assessment
        payload = {
            "mood_score": 4,
            "sleep_quality_score": 4,
            "stress_self_rating": 3,
            "help_requested": False,
            "free_text_note": "Feeling good on shift today.",
        }

        resp = self.client.post(
            "/wellness/assessment",
            json=payload,
            headers={"Authorization": f"Bearer {self.personnel_token}"},
        )
        self.assertEqual(resp.status_code, 201)

        # Verify a new row exists in analytics.risk_scores immediately
        new_count = (
            self.db.query(RiskScore)
            .filter(RiskScore.pseudonymous_id == self.test_pid)
            .count()
        )
        self.assertEqual(new_count, initial_count + 1)

        latest_score = (
            self.db.query(RiskScore)
            .filter(RiskScore.pseudonymous_id == self.test_pid)
            .order_by(RiskScore.computed_at.desc())
            .first()
        )

        self.assertIsNotNone(latest_score)
        self.assertIsInstance(latest_score.calibrated_score, int)
        self.assertTrue(0 <= latest_score.calibrated_score <= 100)
        self.assertIn(latest_score.risk_category, ["low", "moderate", "high", "critical"])
        self.assertIsInstance(latest_score.contributing_factors, list)
        self.assertIsInstance(latest_score.rule_flags, dict)

    def test_multiple_submissions_preserve_history(self):
        """Validates that successive assessment submissions create multiple risk_scores rows (preserving history)."""
        count_before = (
            self.db.query(RiskScore)
            .filter(RiskScore.pseudonymous_id == self.test_pid)
            .count()
        )

        # Submit 2 assessments in sequence
        for mood in [3, 2]:
            resp = self.client.post(
                "/wellness/assessment",
                json={"mood_score": mood, "sleep_quality_score": 3, "stress_self_rating": 5, "help_requested": False},
                headers={"Authorization": f"Bearer {self.personnel_token}"},
            )
            self.assertEqual(resp.status_code, 201)

        count_after = (
            self.db.query(RiskScore)
            .filter(RiskScore.pseudonymous_id == self.test_pid)
            .count()
        )
        self.assertEqual(count_after, count_before + 2)

    def test_help_requested_submission_immediately_creates_critical_score(self):
        """Validates that submitting help_requested=True synchronously produces a critical score in risk_scores."""
        resp = self.client.post(
            "/wellness/assessment",
            json={
                "mood_score": 4,
                "sleep_quality_score": 4,
                "stress_self_rating": 2,
                "help_requested": True,
            },
            headers={"Authorization": f"Bearer {self.personnel_token}"},
        )
        self.assertEqual(resp.status_code, 201)

        latest_score = (
            self.db.query(RiskScore)
            .filter(RiskScore.pseudonymous_id == self.test_pid)
            .order_by(RiskScore.computed_at.desc())
            .first()
        )

        self.assertIsNotNone(latest_score)
        self.assertEqual(latest_score.risk_category, "critical")
        self.assertGreaterEqual(latest_score.calibrated_score, 85)
        self.assertTrue(latest_score.rule_flags.get("help_requested"))

        factors_str = " ".join([str(f) for f in latest_score.contributing_factors]).lower()
        self.assertTrue("help" in factors_str or "assistance" in factors_str)

    def test_hr_seed_computes_and_persists_risk_scores(self):
        """Validates that POST /hr/seed inserts risk_scores entries alongside other tables."""
        resp = self.client.post(
            "/hr/seed",
            json={"num_people": 3, "months": 1, "clear_existing": False, "random_seed": 777},
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("risk_scores", data["inserted_counts"])
        self.assertEqual(data["inserted_counts"]["risk_scores"], 3)


if __name__ == "__main__":
    unittest.main()
