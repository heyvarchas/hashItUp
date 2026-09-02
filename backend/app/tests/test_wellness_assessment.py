"""
Integration and validation tests for Phase 4:
- 4.1: POST /wellness/assessment endpoint.
- 4.2: GET /wellness/history endpoint.
"""

import unittest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import SessionLocal
from app.jwt_auth import create_access_token
from app.main import app
from app.models import Personnel, UserRole, WellnessAssessment
from app.security import hash_password


class TestWellnessAssessmentSubmissionAndHistory(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()

        # Create Personnel 1
        cls.p1_id = uuid.uuid4()
        cls.p1_pseudo_id = uuid.uuid4()
        cls.p1 = Personnel(
            person_id=cls.p1_id,
            service_number=f"TEST-P1-{str(uuid.uuid4())[:8]}",
            password_hash=hash_password("password123"),
            pseudonymous_id=cls.p1_pseudo_id,
            active=True,
        )
        cls.p1_role = UserRole(person_id=cls.p1_id, role="personnel")

        # Create Personnel 2
        cls.p2_id = uuid.uuid4()
        cls.p2_pseudo_id = uuid.uuid4()
        cls.p2 = Personnel(
            person_id=cls.p2_id,
            service_number=f"TEST-P2-{str(uuid.uuid4())[:8]}",
            password_hash=hash_password("password123"),
            pseudonymous_id=cls.p2_pseudo_id,
            active=True,
        )
        cls.p2_role = UserRole(person_id=cls.p2_id, role="personnel")

        # Create Welfare Officer
        cls.w_id = uuid.uuid4()
        cls.w_pseudo_id = uuid.uuid4()
        cls.w = Personnel(
            person_id=cls.w_id,
            service_number=f"TEST-W-{str(uuid.uuid4())[:8]}",
            password_hash=hash_password("password123"),
            pseudonymous_id=cls.w_pseudo_id,
            active=True,
        )
        cls.w_role = UserRole(person_id=cls.w_id, role="welfare_officer")

        # Create Admin
        cls.a_id = uuid.uuid4()
        cls.a_pseudo_id = uuid.uuid4()
        cls.a = Personnel(
            person_id=cls.a_id,
            service_number=f"TEST-A-{str(uuid.uuid4())[:8]}",
            password_hash=hash_password("password123"),
            pseudonymous_id=cls.a_pseudo_id,
            active=True,
        )
        cls.a_role = UserRole(person_id=cls.a_id, role="admin")

        cls.db.add_all([cls.p1, cls.p2, cls.w, cls.a, cls.p1_role, cls.p2_role, cls.w_role, cls.a_role])
        cls.db.commit()

        # Tokens
        cls.personnel_token = create_access_token(
            person_id=str(cls.p1_id),
            pseudonymous_id=str(cls.p1_pseudo_id),
            role="personnel",
        )

        cls.personnel2_token = create_access_token(
            person_id=str(cls.p2_id),
            pseudonymous_id=str(cls.p2_pseudo_id),
            role="personnel",
        )

        cls.welfare_token = create_access_token(
            person_id=str(cls.w_id),
            pseudonymous_id=str(cls.w_pseudo_id),
            role="welfare_officer",
        )

        cls.admin_token = create_access_token(
            person_id=str(cls.a_id),
            pseudonymous_id=str(cls.a_pseudo_id),
            role="admin",
        )

    @classmethod
    def tearDownClass(cls):
        try:
            # Clean up all assessments created for test personnel
            test_pseudo_ids = [cls.p1_pseudo_id, cls.p2_pseudo_id, cls.w_pseudo_id, cls.a_pseudo_id]
            cls.db.query(WellnessAssessment).filter(WellnessAssessment.pseudonymous_id.in_(test_pseudo_ids)).delete(synchronize_session=False)

            # Clean up roles and personnel
            test_person_ids = [cls.p1_id, cls.p2_id, cls.w_id, cls.a_id]
            cls.db.query(UserRole).filter(UserRole.person_id.in_(test_person_ids)).delete(synchronize_session=False)
            cls.db.query(Personnel).filter(Personnel.person_id.in_(test_person_ids)).delete(synchronize_session=False)
            cls.db.commit()
        finally:
            cls.db.close()

    # -----------------------------------------------------------------------
    # Task 4.1: POST /wellness/assessment Tests
    # -----------------------------------------------------------------------

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
        self.assertEqual(data["pseudonymous_id"], str(self.p1_pseudo_id))
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
            self.assertEqual(db_record.pseudonymous_id, self.p1_pseudo_id)
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
        self.assertEqual(data["pseudonymous_id"], str(self.p1_pseudo_id))
        self.assertNotEqual(data["pseudonymous_id"], attacker_supplied_id)

        assessment_id = uuid.UUID(data["id"])

        db = SessionLocal()
        try:
            db_record = db.query(WellnessAssessment).filter(WellnessAssessment.id == assessment_id).first()
            self.assertIsNotNone(db_record)
            self.assertEqual(db_record.pseudonymous_id, self.p1_pseudo_id)
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

    # -----------------------------------------------------------------------
    # Task 4.2: GET /wellness/history Tests
    # -----------------------------------------------------------------------

    def test_unauthenticated_history_rejected(self):
        resp = self.client.get("/wellness/history")
        self.assertEqual(resp.status_code, 403)

    def test_personnel_sees_only_own_history(self):
        # 1. Submit assessments for personnel 1
        self.client.post(
            "/wellness/assessment",
            json={"mood_score": 5, "sleep_quality_score": 4, "stress_self_rating": 2},
            headers={"Authorization": f"Bearer {self.personnel_token}"},
        )
        self.client.post(
            "/wellness/assessment",
            json={"mood_score": 3, "sleep_quality_score": 3, "stress_self_rating": 7},
            headers={"Authorization": f"Bearer {self.personnel_token}"},
        )

        # 2. Submit assessment for personnel 2
        self.client.post(
            "/wellness/assessment",
            json={"mood_score": 1, "sleep_quality_score": 2, "stress_self_rating": 9},
            headers={"Authorization": f"Bearer {self.personnel2_token}"},
        )

        # 3. Personnel 1 queries history
        resp = self.client.get(
            "/wellness/history",
            headers={"Authorization": f"Bearer {self.personnel_token}"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertGreaterEqual(len(data), 2)

        # Verify all items belong exclusively to personnel 1
        for item in data:
            self.assertEqual(item["pseudonymous_id"], str(self.p1_pseudo_id))

    def test_personnel_cannot_pass_someone_elses_pseudonymous_id(self):
        # Personnel 1 attempts to pass Personnel 2's ID
        resp = self.client.get(
            f"/wellness/history?pseudonymous_id={self.p2_pseudo_id}",
            headers={"Authorization": f"Bearer {self.personnel_token}"},
        )
        self.assertEqual(resp.status_code, 403)
        self.assertIn("not permitted", resp.json()["detail"].lower())

    def test_personnel_passing_own_pseudonymous_id_is_permitted(self):
        # Personnel 1 explicitly passes own ID
        resp = self.client.get(
            f"/wellness/history?pseudonymous_id={self.p1_pseudo_id}",
            headers={"Authorization": f"Bearer {self.personnel_token}"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        for item in data:
            self.assertEqual(item["pseudonymous_id"], str(self.p1_pseudo_id))

    def test_welfare_officer_can_query_any_personnel_history(self):
        # Welfare officer queries history for personnel 1
        resp_p1 = self.client.get(
            f"/wellness/history?pseudonymous_id={self.p1_pseudo_id}",
            headers={"Authorization": f"Bearer {self.welfare_token}"},
        )
        self.assertEqual(resp_p1.status_code, 200)
        data_p1 = resp_p1.json()
        self.assertGreaterEqual(len(data_p1), 1)
        for item in data_p1:
            self.assertEqual(item["pseudonymous_id"], str(self.p1_pseudo_id))

        # Welfare officer queries history for personnel 2
        resp_p2 = self.client.get(
            f"/wellness/history?pseudonymous_id={self.p2_pseudo_id}",
            headers={"Authorization": f"Bearer {self.welfare_token}"},
        )
        self.assertEqual(resp_p2.status_code, 200)
        data_p2 = resp_p2.json()
        self.assertGreaterEqual(len(data_p2), 1)
        for item in data_p2:
            self.assertEqual(item["pseudonymous_id"], str(self.p2_pseudo_id))

    def test_welfare_officer_can_query_all_history(self):
        resp = self.client.get(
            "/wellness/history?limit=10",
            headers={"Authorization": f"Bearer {self.welfare_token}"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIsInstance(data, list)


if __name__ == "__main__":
    unittest.main()
