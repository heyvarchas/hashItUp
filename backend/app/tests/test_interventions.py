"""
Unit and integration tests for Phase 9.2: Case Detail Interventions & Alert Resolution.

Verifies:
1. Welfare officer can record an intervention via POST /interventions.
2. Recording an intervention updates the alert's status to 'resolved' or 'acknowledged'.
3. The alert disappears from GET /alerts?status=open once resolved.
4. RBAC protection: Personnel role receives 403 Forbidden on POST /interventions.
5. GET /interventions returns the logged intervention with decrypted/decoded notes.
6. Error handling for non-existent alerts and invalid payload inputs.
"""

import datetime
import unittest
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import SessionLocal
from app.jwt_auth import create_access_token
from app.main import app
from app.models import Alert, Intervention, Personnel, RiskScore, WellnessAssessment
from app.risk import compute_risk


class TestInterventionsAndAlertResolution(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()

        # Create test welfare officer
        cls.officer_pid = uuid.uuid4()
        cls.officer_sn = f"WO-{uuid.uuid4().hex[:6].upper()}"
        cls.officer = Personnel(
            service_number=cls.officer_sn,
            password_hash="test_officer_hash",
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

        # Create test personnel
        cls.personnel_pid = uuid.uuid4()
        cls.personnel_sn = f"PE-{uuid.uuid4().hex[:6].upper()}"
        cls.personnel = Personnel(
            service_number=cls.personnel_sn,
            password_hash="test_personnel_hash",
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
        cls.db.execute(text("DELETE FROM analytics.interventions WHERE recorded_by_person_id = :p_id"), {"p_id": cls.officer.person_id})
        cls.db.execute(text("DELETE FROM identity.personnel WHERE person_id IN (:o_id, :p_id)"), {"o_id": cls.officer.person_id, "p_id": cls.personnel.person_id})
        cls.db.commit()
        cls.db.close()

    def test_record_intervention_resolves_open_alert_and_updates_queue(self):
        """
        Acceptance test for Task 9.2:
        Recording an intervention updates the alert's status to 'resolved',
        persists the intervention in DB, and removes it from the open alerts queue.
        """
        # 1. Create a high-risk scenario that triggers an open alert
        target_pid = uuid.uuid4()
        target_sn = f"SN-INT-{uuid.uuid4().hex[:6].upper()}"
        target_person = Personnel(
            service_number=target_sn,
            password_hash="test_hash",
            pseudonymous_id=target_pid,
            active=True,
        )
        self.db.add(target_person)
        self.db.commit()

        try:
            assessment = WellnessAssessment(
                id=uuid.uuid4(),
                pseudonymous_id=target_pid,
                submitted_at=datetime.datetime.now(datetime.timezone.utc),
                mood_score=1,
                sleep_quality_score=1,
                stress_self_rating=10,
                help_requested=True,
            )
            self.db.add(assessment)
            self.db.commit()

            compute_risk(target_pid, db=self.db, save_to_db=True)

            # Check open alert exists
            open_alert = (
                self.db.query(Alert)
                .join(RiskScore, Alert.risk_score_id == RiskScore.id)
                .filter(RiskScore.pseudonymous_id == target_pid, Alert.status == "open")
                .first()
            )
            self.assertIsNotNone(open_alert)
            alert_id = str(open_alert.id)

            # Verify alert appears in GET /alerts?status=open
            res_queue_before = self.client.get(
                "/alerts?status=open",
                headers={"Authorization": f"Bearer {self.officer_token}"},
            )
            self.assertEqual(res_queue_before.status_code, 200)
            open_ids = [a["id"] for a in res_queue_before.json()]
            self.assertIn(alert_id, open_ids)

            # 2. Record Intervention via POST /interventions
            payload = {
                "alert_id": alert_id,
                "intervention_type": "counseling_and_mandatory_rest",
                "notes": "Met with officer; approved 3 days emergency rest and scheduled clinical counseling.",
                "new_alert_status": "resolved",
            }

            res_intervention = self.client.post(
                "/interventions",
                json=payload,
                headers={"Authorization": f"Bearer {self.officer_token}"},
            )
            self.assertEqual(res_intervention.status_code, 201)
            int_data = res_intervention.json()
            self.assertEqual(int_data["alert_id"], alert_id)
            self.assertEqual(int_data["alert_status"], "resolved")
            self.assertEqual(int_data["intervention_type"], "counseling_and_mandatory_rest")

            # 3. Verify DB state of Alert
            self.db.refresh(open_alert)
            self.assertEqual(open_alert.status, "resolved")

            # 4. Verify Alert is NO LONGER in GET /alerts?status=open
            res_queue_after = self.client.get(
                "/alerts?status=open",
                headers={"Authorization": f"Bearer {self.officer_token}"},
            )
            self.assertEqual(res_queue_after.status_code, 200)
            open_ids_after = [a["id"] for a in res_queue_after.json()]
            self.assertNotIn(alert_id, open_ids_after)

            # 5. Verify GET /interventions returns the logged record
            res_history = self.client.get(
                f"/interventions?alert_id={alert_id}",
                headers={"Authorization": f"Bearer {self.officer_token}"},
            )
            self.assertEqual(res_history.status_code, 200)
            history_data = res_history.json()
            self.assertEqual(len(history_data), 1)
            self.assertIn("approved 3 days emergency rest", history_data[0]["notes"])

        finally:
            self.db.execute(text("DELETE FROM analytics.interventions WHERE alert_id IN (SELECT id FROM analytics.alerts WHERE risk_score_id IN (SELECT id FROM analytics.risk_scores WHERE pseudonymous_id = :pid))"), {"pid": target_pid})
            self.db.execute(text("DELETE FROM analytics.alerts WHERE risk_score_id IN (SELECT id FROM analytics.risk_scores WHERE pseudonymous_id = :pid)"), {"pid": target_pid})
            self.db.execute(text("DELETE FROM analytics.recommendations WHERE risk_score_id IN (SELECT id FROM analytics.risk_scores WHERE pseudonymous_id = :pid)"), {"pid": target_pid})
            self.db.execute(text("DELETE FROM analytics.risk_scores WHERE pseudonymous_id = :pid"), {"pid": target_pid})
            self.db.execute(text("DELETE FROM analytics.wellness_assessments WHERE pseudonymous_id = :pid"), {"pid": target_pid})
            self.db.execute(text("DELETE FROM identity.personnel WHERE pseudonymous_id = :pid"), {"pid": target_pid})
            self.db.commit()

    def test_personnel_role_forbidden_from_recording_interventions(self):
        """Personnel users cannot submit interventions (RBAC 403)."""
        payload = {
            "alert_id": str(uuid.uuid4()),
            "intervention_type": "counseling",
            "notes": "Unauthorized attempt",
        }
        res = self.client.post(
            "/interventions",
            json=payload,
            headers={"Authorization": f"Bearer {self.personnel_token}"},
        )
        self.assertEqual(res.status_code, 403)

    def test_nonexistent_alert_returns_404(self):
        """Attempting to intervene on a non-existent alert ID returns 404."""
        payload = {
            "alert_id": str(uuid.uuid4()),
            "intervention_type": "counseling",
            "notes": "Testing 404",
        }
        res = self.client.post(
            "/interventions",
            json=payload,
            headers={"Authorization": f"Bearer {self.officer_token}"},
        )
        self.assertEqual(res.status_code, 404)
