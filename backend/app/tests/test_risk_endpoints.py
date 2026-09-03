"""
Unit and integration tests for Phase 6.4: Risk Detail Endpoints.

Verifies:
1. `GET /personnel/{pseudonymous_id}/risk`:
   - RBAC: Accessible by `welfare_officer` and `admin`; rejected for `personnel` (403) or unauthenticated (403).
   - Returns 404 for non-existent pseudonymous_id.
   - Returns clinical/objective risk assessment details (score, category, contributing_factors, rule_flags).
2. `GET /risk/me`:
   - RBAC: Accessible by `personnel`; rejected for `welfare_officer` (403) or unauthenticated (403).
   - Returns current user's risk overview with supportive, non-clinical phrasing for contributing_factors.
3. Supportive wording transformation matches Section 29 requirements:
   - Clinical alarming phrasing is swapped for supportive, constructive language on `/risk/me`.
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


class TestRiskEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()

        # Create a test personnel with known profile
        cls.test_sn = f"SN-ENDP-{uuid.uuid4().hex[:6].upper()}"
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

        # Tokens
        cls.personnel_token = create_access_token(
            person_id=str(cls.test_person_id),
            pseudonymous_id=str(cls.test_pid),
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

    @classmethod
    def tearDownClass(cls):
        cls.db.execute(text("DELETE FROM analytics.recommendations WHERE risk_score_id IN (SELECT id FROM analytics.risk_scores WHERE pseudonymous_id = :pid)"), {"pid": cls.test_pid})
        cls.db.execute(text("DELETE FROM analytics.risk_scores WHERE pseudonymous_id = :pid"), {"pid": cls.test_pid})
        cls.db.execute(text("DELETE FROM analytics.wellness_assessments WHERE pseudonymous_id = :pid"), {"pid": cls.test_pid})
        cls.db.execute(text("DELETE FROM identity.personnel WHERE pseudonymous_id = :pid"), {"pid": cls.test_pid})
        cls.db.commit()
        cls.db.close()


    # -------------------------------------------------------------------------
    # 1. RBAC Tests
    # -------------------------------------------------------------------------

    def test_officer_endpoint_rbac_permissions(self):
        """Validates that GET /personnel/{pseudonymous_id}/risk is restricted to welfare_officer/admin."""
        url = f"/personnel/{self.test_pid}/risk"

        # 1. Unauthenticated -> 403
        resp_unauth = self.client.get(url)
        self.assertEqual(resp_unauth.status_code, 403)

        # 2. Personnel role -> 403 Forbidden
        resp_personnel = self.client.get(
            url,
            headers={"Authorization": f"Bearer {self.personnel_token}"},
        )
        self.assertEqual(resp_personnel.status_code, 403)

        # 3. Welfare officer -> 200 OK
        resp_welfare = self.client.get(
            url,
            headers={"Authorization": f"Bearer {self.welfare_token}"},
        )
        self.assertEqual(resp_welfare.status_code, 200)

        # 4. Admin -> 200 OK
        resp_admin = self.client.get(
            url,
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(resp_admin.status_code, 200)

    def test_personnel_endpoint_rbac_permissions(self):
        """Validates that GET /risk/me is restricted to personnel role."""
        url = "/risk/me"

        # 1. Unauthenticated -> 403
        resp_unauth = self.client.get(url)
        self.assertEqual(resp_unauth.status_code, 403)

        # 2. Welfare officer -> 403 Forbidden
        resp_welfare = self.client.get(
            url,
            headers={"Authorization": f"Bearer {self.welfare_token}"},
        )
        self.assertEqual(resp_welfare.status_code, 403)

        # 3. Personnel -> 200 OK
        resp_personnel = self.client.get(
            url,
            headers={"Authorization": f"Bearer {self.personnel_token}"},
        )
        self.assertEqual(resp_personnel.status_code, 200)

    def test_officer_endpoint_not_found(self):
        """Validates 404 when querying an unknown pseudonymous_id."""
        random_id = uuid.uuid4()
        resp = self.client.get(
            f"/personnel/{random_id}/risk",
            headers={"Authorization": f"Bearer {self.welfare_token}"},
        )
        self.assertEqual(resp.status_code, 404)

    # -------------------------------------------------------------------------
    # 2. Functional & Supportive Framing Tests
    # -------------------------------------------------------------------------

    def test_officer_endpoint_returns_clinical_detail(self):
        """Validates that officer endpoint returns clinical/objective metrics."""
        # Insert assessment with sleep & mood drop
        self.client.post(
            "/wellness/assessment",
            json={"mood_score": 2, "sleep_quality_score": 2, "stress_self_rating": 8, "help_requested": False},
            headers={"Authorization": f"Bearer {self.personnel_token}"},
        )

        resp = self.client.get(
            f"/personnel/{self.test_pid}/risk",
            headers={"Authorization": f"Bearer {self.welfare_token}"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        self.assertEqual(data["pseudonymous_id"], str(self.test_pid))
        self.assertIsInstance(data["calibrated_score"], int)
        self.assertIn(data["risk_category"], ["low", "moderate", "high", "critical"])
        self.assertIsInstance(data["contributing_factors"], list)
        self.assertGreater(len(data["contributing_factors"]), 0)

        print("\n[Welfare Officer View]:")
        print(f"  Score   : {data['calibrated_score']} ({data['risk_category']})")
        print(f"  Factors : {data['contributing_factors']}")

    def test_personnel_endpoint_uses_supportive_language(self):
        """
        Phase 6.4 Acceptance Criterion:
        GET /risk/me returns score, category, and supportive, non-clinical contributing factors.
        """
        # Insert assessment with help_requested=True
        self.client.post(
            "/wellness/assessment",
            json={"mood_score": 3, "sleep_quality_score": 3, "stress_self_rating": 5, "help_requested": True},
            headers={"Authorization": f"Bearer {self.personnel_token}"},
        )

        # 1. Fetch via personnel endpoint GET /risk/me
        resp_me = self.client.get(
            "/risk/me",
            headers={"Authorization": f"Bearer {self.personnel_token}"},
        )
        self.assertEqual(resp_me.status_code, 200)
        data_me = resp_me.json()

        self.assertEqual(data_me["pseudonymous_id"], str(self.test_pid))
        self.assertEqual(data_me["risk_category"], "critical")
        self.assertGreaterEqual(data_me["calibrated_score"], 85)
        self.assertIsInstance(data_me["contributing_factors"], list)

        # 2. Fetch via officer endpoint GET /personnel/{id}/risk
        resp_officer = self.client.get(
            f"/personnel/{self.test_pid}/risk",
            headers={"Authorization": f"Bearer {self.welfare_token}"},
        )
        self.assertEqual(resp_officer.status_code, 200)
        data_officer = resp_officer.json()

        print("\n[Personnel Supportive View vs Officer Clinical View]:")
        print(f"  Personnel Factors: {data_me['contributing_factors']}")
        print(f"  Officer Factors  : {data_officer['contributing_factors']}")

        # Verify supportive phrasing on personnel view
        me_text = " ".join(data_me["contributing_factors"])
        self.assertTrue(
            "our team is here to support you" in me_text
            or "prioritize" in me_text
            or "self-care" in me_text
            or "support" in me_text.lower()
        )


if __name__ == "__main__":
    unittest.main()
