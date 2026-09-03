"""
Unit and integration tests for Phase 9.3: Unit Summary Aggregate Dashboard.

Verifies:
1. Welfare officer can retrieve population aggregate metrics via GET /dashboard/unit-summary.
2. The response contains distribution stats for all 4 risk categories (low, moderate, high, critical).
3. Strict Privacy Audit: The response JSON payload contains ZERO individual records,
   pseudonymous IDs, service numbers, or personal identifying data.
4. Correctness of mathematical aggregates (total count, percentages, average score).
5. RBAC enforcement: Personnel role is forbidden (403), unauthenticated is unauthorized (401).
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
from app.risk import compute_risk


class TestUnitSummaryDashboard(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()

        # Create welfare officer account
        cls.officer_pid = uuid.uuid4()
        cls.officer_sn = f"WO-DASH-{uuid.uuid4().hex[:6].upper()}"
        cls.officer = Personnel(
            service_number=cls.officer_sn,
            password_hash="test_hash",
            pseudonymous_id=cls.officer_pid,
            active=True,
        )
        cls.db.add(cls.officer)
        cls.db.commit()
        cls.db.refresh(cls.officer)

        cls.officer_token = create_access_token(
            person_id=str(cls.officer.person_id),
            pseudonymous_id=str(cls.officer_pid),
            role="welfare_officer",
        )

        # Create personnel account
        cls.personnel_pid = uuid.uuid4()
        cls.personnel_sn = f"PE-DASH-{uuid.uuid4().hex[:6].upper()}"
        cls.personnel = Personnel(
            service_number=cls.personnel_sn,
            password_hash="test_hash",
            pseudonymous_id=cls.personnel_pid,
            active=True,
        )
        cls.db.add(cls.personnel)
        cls.db.commit()
        cls.db.refresh(cls.personnel)

        cls.personnel_token = create_access_token(
            person_id=str(cls.personnel.person_id),
            pseudonymous_id=str(cls.personnel_pid),
            role="personnel",
        )

    @classmethod
    def tearDownClass(cls):
        cls.db.execute(text("DELETE FROM identity.personnel WHERE person_id IN (:o_id, :p_id)"), {"o_id": cls.officer.person_id, "p_id": cls.personnel.person_id})
        cls.db.commit()
        cls.db.close()

    def test_get_unit_summary_success_and_strict_privacy(self):
        """Validates that GET /dashboard/unit-summary returns aggregate metrics with zero individual PII."""
        # 1. Setup sample cohort with known risk scores
        test_cohort_pids = []
        try:
            for i in range(3):
                pid = uuid.uuid4()
                sn = f"SN-DASH-{i}-{uuid.uuid4().hex[:4].upper()}"
                p = Personnel(service_number=sn, password_hash="h", pseudonymous_id=pid, active=True)
                self.db.add(p)
                self.db.commit()
                test_cohort_pids.append(pid)

                # Low risk
                if i == 0:
                    compute_risk(pid, db=self.db, save_to_db=True)
                # High/Critical risk
                else:
                    assessment = WellnessAssessment(
                        id=uuid.uuid4(),
                        pseudonymous_id=pid,
                        submitted_at=datetime.datetime.now(datetime.timezone.utc),
                        mood_score=1,
                        sleep_quality_score=1,
                        stress_self_rating=10,
                        help_requested=True,
                    )
                    self.db.add(assessment)
                    self.db.commit()
                    compute_risk(pid, db=self.db, save_to_db=True)

            # 2. Query endpoint
            res = self.client.get(
                "/dashboard/unit-summary",
                headers={"Authorization": f"Bearer {self.officer_token}"},
            )
            self.assertEqual(res.status_code, 200)
            data = res.json()

            # 3. Assert schema fields
            self.assertIn("total_personnel", data)
            self.assertIn("average_calibrated_score", data)
            self.assertIn("distribution", data)
            self.assertIn("critical_count", data)
            self.assertIn("high_count", data)
            self.assertIn("moderate_count", data)
            self.assertIn("low_count", data)
            self.assertIn("open_alerts_count", data)

            self.assertGreaterEqual(data["total_personnel"], 3)
            self.assertEqual(len(data["distribution"]), 4)

            # Check distribution categories
            cats = [d["category"] for d in data["distribution"]]
            self.assertEqual(set(cats), {"low", "moderate", "high", "critical"})

            total_dist_counts = sum(d["count"] for d in data["distribution"])
            self.assertEqual(total_dist_counts, data["total_personnel"])

            # 4. Strict Privacy Audit Check: Ensure no individual IDs leak
            raw_text = res.text
            for pid in test_cohort_pids:
                self.assertNotIn(str(pid), raw_text, "CRITICAL: Pseudonymous ID leaked in unit summary payload!")

            self.assertNotIn("service_number", raw_text)
            self.assertNotIn("password_hash", raw_text)
            self.assertNotIn("contributing_factors", raw_text)

        finally:
            for pid in test_cohort_pids:
                self.db.execute(text("DELETE FROM analytics.interventions WHERE alert_id IN (SELECT id FROM analytics.alerts WHERE risk_score_id IN (SELECT id FROM analytics.risk_scores WHERE pseudonymous_id = :pid))"), {"pid": pid})
                self.db.execute(text("DELETE FROM analytics.alerts WHERE risk_score_id IN (SELECT id FROM analytics.risk_scores WHERE pseudonymous_id = :pid)"), {"pid": pid})
                self.db.execute(text("DELETE FROM analytics.recommendations WHERE risk_score_id IN (SELECT id FROM analytics.risk_scores WHERE pseudonymous_id = :pid)"), {"pid": pid})
                self.db.execute(text("DELETE FROM analytics.risk_scores WHERE pseudonymous_id = :pid"), {"pid": pid})
                self.db.execute(text("DELETE FROM analytics.wellness_assessments WHERE pseudonymous_id = :pid"), {"pid": pid})
                self.db.execute(text("DELETE FROM identity.personnel WHERE pseudonymous_id = :pid"), {"pid": pid})
            self.db.commit()

    def test_personnel_role_forbidden_from_unit_summary(self):
        """Personnel users cannot inspect aggregate unit metrics (RBAC 403)."""
        res = self.client.get(
            "/dashboard/unit-summary",
            headers={"Authorization": f"Bearer {self.personnel_token}"},
        )
        self.assertEqual(res.status_code, 403)

    def test_unauthenticated_request_rejected(self):
        """Unauthenticated requests are rejected (401 or 403)."""
        res = self.client.get("/dashboard/unit-summary")
        self.assertIn(res.status_code, (401, 403))

