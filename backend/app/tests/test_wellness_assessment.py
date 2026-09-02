"""
Integration and validation tests for Phase 4.1: POST /wellness/assessment endpoint.
"""

import unittest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import SessionLocal
from app.jwt_auth import create_access_token
from app.main import app
from app.models import WellnessAssessment


class TestWellnessAssessmentSubmission(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

        cls.personnel_person_id = uuid.uuid4()
        cls.personnel_pseudo_id = uuid.uuid4()
        cls.personnel_token = create_access_token(
            person_id=str(cls.personnel_person_id),
            pseudonymous_id=str(cls.personnel_pseudo_id),
            role="personnel",
        )

        cls.welfare_token = create_access_token(
            person_id=str(uuid.uuid4()),
            pseudonymous_id=str(uuid.uuid4()),
            role="welfare_officer",
        )

        cls.admin_token = create_access_token(
            person_id=str(uuid.uuid4()),
            pseudonymous_id=str(uuid.uuid4()),
            role="admin",
        )

    def test_unauthenticated_request_rejected(self):
        resp = self.client.post("/wellness/assessment", json={"mood_score": 3})
        self.assertEqual(resp.status_code, 403)

    def test_non_personnel_roles_rejected(self):
        payload = {
            "mood_score": 4,
            "sleep_quality_score": 3,
            "stress_self_rating": 5,
            "help_requested": False,
        }

        # Welfare officer rejected
        resp_w = self.client.post(
            "/wellness/assessment",
            json=payload,
            headers={"Authorization": f"Bearer {self.welfare_token}"},
        )
        self.assertEqual(resp_w.status_code, 403)

        # Admin rejected
        resp_a = self.client.post(
            "/wellness/assessment",
            json=payload,
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(resp_a.status_code, 403)

    def test_personnel_assessment_submission_success(self):
        payload = {
            "mood_score": 4,
            "sleep_quality_score": 3,
            "stress_self_rating": 6,
            "help_requested": True,
            "free_text_note": "Feeling slightly fatigued after extended night patrol.",
        }

        resp = self.client.post(
            "/wellness/assessment",
            json=payload,
            headers={"Authorization": f"Bearer {self.personnel_token}"},
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.json()

        # Check response attributes
        self.assertEqual(data["pseudonymous_id"], str(self.personnel_pseudo_id))
        self.assertEqual(data["mood_score"], 4)
        self.assertEqual(data["sleep_quality_score"], 3)
        self.assertEqual(data["stress_self_rating"], 6)
        self.assertTrue(data["help_requested"])
        self.assertIn("id", data)
        self.assertIn("submitted_at", data)
        self.assertNotIn("free_text_note_enc", data)

        assessment_id = uuid.UUID(data["id"])

        # Check in Database directly
        db = SessionLocal()
        try:
            db_record = db.query(WellnessAssessment).filter(WellnessAssessment.id == assessment_id).first()
            self.assertIsNotNone(db_record)
            self.assertEqual(db_record.pseudonymous_id, self.personnel_pseudo_id)
            self.assertEqual(db_record.mood_score, 4)
            self.assertEqual(db_record.sleep_quality_score, 3)
            self.assertEqual(db_record.stress_self_rating, 6)
            self.assertTrue(db_record.help_requested)
            self.assertEqual(
                db_record.free_text_note_enc,
                b"Feeling slightly fatigued after extended night patrol.",
            )
        finally:
            db.close()

    def test_client_supplied_pseudonymous_id_is_ignored_and_overridden_by_jwt(self):
        attacker_supplied_id = str(uuid.uuid4())
        payload = {
            "pseudonymous_id": attacker_supplied_id,
            "mood_score": 2,
            "sleep_quality_score": 2,
            "stress_self_rating": 8,
            "help_requested": False,
            "free_text_note": "Attempting spoofing",
        }

        resp = self.client.post(
            "/wellness/assessment",
            json=payload,
            headers={"Authorization": f"Bearer {self.personnel_token}"},
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.json()

        # Must be tied to the JWT's pseudonymous_id, NOT attacker_supplied_id
        self.assertEqual(data["pseudonymous_id"], str(self.personnel_pseudo_id))
        self.assertNotEqual(data["pseudonymous_id"], attacker_supplied_id)

        assessment_id = uuid.UUID(data["id"])

        db = SessionLocal()
        try:
            db_record = db.query(WellnessAssessment).filter(WellnessAssessment.id == assessment_id).first()
            self.assertIsNotNone(db_record)
            self.assertEqual(db_record.pseudonymous_id, self.personnel_pseudo_id)
            self.assertNotEqual(db_record.pseudonymous_id, uuid.UUID(attacker_supplied_id))

            # Verify no record exists with attacker_supplied_id
            spoofed_records = db.query(WellnessAssessment).filter(
                WellnessAssessment.pseudonymous_id == uuid.UUID(attacker_supplied_id)
            ).all()
            self.assertEqual(len(spoofed_records), 0)
        finally:
            db.close()

    def test_pydantic_input_range_validations(self):
        # mood_score > 5
        resp = self.client.post(
            "/wellness/assessment",
            json={"mood_score": 6},
            headers={"Authorization": f"Bearer {self.personnel_token}"},
        )
        self.assertEqual(resp.status_code, 422)

        # mood_score < 1
        resp = self.client.post(
            "/wellness/assessment",
            json={"mood_score": 0},
            headers={"Authorization": f"Bearer {self.personnel_token}"},
        )
        self.assertEqual(resp.status_code, 422)

        # sleep_quality_score > 5
        resp = self.client.post(
            "/wellness/assessment",
            json={"sleep_quality_score": 6},
            headers={"Authorization": f"Bearer {self.personnel_token}"},
        )
        self.assertEqual(resp.status_code, 422)

        # sleep_quality_score < 1
        resp = self.client.post(
            "/wellness/assessment",
            json={"sleep_quality_score": -1},
            headers={"Authorization": f"Bearer {self.personnel_token}"},
        )
        self.assertEqual(resp.status_code, 422)

        # stress_self_rating > 10
        resp = self.client.post(
            "/wellness/assessment",
            json={"stress_self_rating": 11},
            headers={"Authorization": f"Bearer {self.personnel_token}"},
        )
        self.assertEqual(resp.status_code, 422)

        # stress_self_rating < 1
        resp = self.client.post(
            "/wellness/assessment",
            json={"stress_self_rating": 0},
            headers={"Authorization": f"Bearer {self.personnel_token}"},
        )
        self.assertEqual(resp.status_code, 422)


if __name__ == "__main__":
    unittest.main()
