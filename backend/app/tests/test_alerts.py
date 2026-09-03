"""
Unit and integration tests for Phase 7.2: Alert Creation & Deduplication.

Verifies:
1. When a risk computation crosses into 'high' or 'critical', an `analytics.alerts` row is created
   with status='open' and matching severity.
2. Deduplication check: When an individual already has an existing status='open' alert,
   triggering subsequent high/critical risk computations updates/skips rather than duplicating.
3. Done When Acceptance Criterion:
   Triggering two consecutive high-risk computations for the same person produces
   exactly one open alert, not two.
4. Resolved/Acknowledged alerts do not block new open alerts:
   If an existing alert is 'resolved' or 'acknowledged', a new high-risk computation
   creates a fresh 'open' alert.
5. Low and moderate risk computations do NOT create alerts.
"""

import datetime
import unittest
import uuid

from sqlalchemy import text

from app.db import SessionLocal
from app.models import Alert, Personnel, RiskScore, WellnessAssessment
from app.risk import compute_risk


class TestAlertCreationAndDeduplication(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_low_and_moderate_risk_does_not_create_alert(self):
        """Validates that low/moderate risk calculations do not create any alert rows."""
        test_sn = f"SN-ALERT-LOW-{uuid.uuid4().hex[:6].upper()}"
        test_pid = uuid.uuid4()
        person = Personnel(
            service_number=test_sn,
            password_hash="test_hash",
            pseudonymous_id=test_pid,
            active=True,
        )
        self.db.add(person)
        self.db.commit()

        try:
            # Baseline low risk computation
            res = compute_risk(test_pid, db=self.db, save_to_db=True)
            self.assertEqual(res["risk_category"], "low")

            alerts = (
                self.db.query(Alert)
                .join(RiskScore, Alert.risk_score_id == RiskScore.id)
                .filter(RiskScore.pseudonymous_id == test_pid)
                .all()
            )
            self.assertEqual(len(alerts), 0)

        finally:
            self.db.execute(text("DELETE FROM analytics.recommendations WHERE risk_score_id IN (SELECT id FROM analytics.risk_scores WHERE pseudonymous_id = :pid)"), {"pid": test_pid})
            self.db.execute(text("DELETE FROM analytics.risk_scores WHERE pseudonymous_id = :pid"), {"pid": test_pid})
            self.db.execute(text("DELETE FROM identity.personnel WHERE pseudonymous_id = :pid"), {"pid": test_pid})
            self.db.commit()

    def test_high_risk_creates_open_alert(self):
        """Validates that a high/critical risk calculation creates an open alert."""
        test_sn = f"SN-ALERT-HIGH-{uuid.uuid4().hex[:6].upper()}"
        test_pid = uuid.uuid4()
        person = Personnel(
            service_number=test_sn,
            password_hash="test_hash",
            pseudonymous_id=test_pid,
            active=True,
        )
        self.db.add(person)
        self.db.commit()

        try:
            # Insert assessment that triggers high/critical risk
            assessment = WellnessAssessment(
                id=uuid.uuid4(),
                pseudonymous_id=test_pid,
                submitted_at=datetime.datetime.now(datetime.timezone.utc),
                mood_score=1,
                sleep_quality_score=1,
                stress_self_rating=9,
                help_requested=True,
            )
            self.db.add(assessment)
            self.db.commit()

            res = compute_risk(test_pid, db=self.db, save_to_db=True)
            self.assertEqual(res["risk_category"], "critical")
            score_id = uuid.UUID(res["risk_score_id"])

            alerts = (
                self.db.query(Alert)
                .join(RiskScore, Alert.risk_score_id == RiskScore.id)
                .filter(RiskScore.pseudonymous_id == test_pid)
                .all()
            )
            self.assertEqual(len(alerts), 1)
            alert = alerts[0]
            self.assertEqual(alert.risk_score_id, score_id)
            self.assertEqual(alert.severity, "critical")
            self.assertEqual(alert.status, "open")

        finally:
            self.db.execute(text("DELETE FROM analytics.alerts WHERE risk_score_id IN (SELECT id FROM analytics.risk_scores WHERE pseudonymous_id = :pid)"), {"pid": test_pid})
            self.db.execute(text("DELETE FROM analytics.recommendations WHERE risk_score_id IN (SELECT id FROM analytics.risk_scores WHERE pseudonymous_id = :pid)"), {"pid": test_pid})
            self.db.execute(text("DELETE FROM analytics.risk_scores WHERE pseudonymous_id = :pid"), {"pid": test_pid})
            self.db.execute(text("DELETE FROM analytics.wellness_assessments WHERE pseudonymous_id = :pid"), {"pid": test_pid})
            self.db.execute(text("DELETE FROM identity.personnel WHERE pseudonymous_id = :pid"), {"pid": test_pid})
            self.db.commit()

    def test_consecutive_high_risk_computations_deduplicate_to_single_open_alert(self):
        """
        Phase 7.2 Done When:
        Triggering two consecutive high-risk computations for the same person
        produces exactly one open alert, not two.
        """
        test_sn = f"SN-ALERT-DEDUP-{uuid.uuid4().hex[:6].upper()}"
        test_pid = uuid.uuid4()
        person = Personnel(
            service_number=test_sn,
            password_hash="test_hash",
            pseudonymous_id=test_pid,
            active=True,
        )
        self.db.add(person)
        self.db.commit()

        try:
            # Assessment 1: high risk trigger (help_requested=True or sudden drop)
            assessment1 = WellnessAssessment(
                id=uuid.uuid4(),
                pseudonymous_id=test_pid,
                submitted_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=2),
                mood_score=1,
                sleep_quality_score=1,
                stress_self_rating=8,
                help_requested=True,
            )
            self.db.add(assessment1)
            self.db.commit()

            # First computation -> creates Alert 1
            res1 = compute_risk(test_pid, db=self.db, save_to_db=True)
            self.assertIn(res1["risk_category"], ["high", "critical"])
            score1_id = uuid.UUID(res1["risk_score_id"])

            open_alerts_1 = (
                self.db.query(Alert)
                .join(RiskScore, Alert.risk_score_id == RiskScore.id)
                .filter(RiskScore.pseudonymous_id == test_pid, Alert.status == "open")
                .all()
            )
            self.assertEqual(len(open_alerts_1), 1)
            initial_alert_id = open_alerts_1[0].id
            self.assertEqual(open_alerts_1[0].risk_score_id, score1_id)


            # Assessment 2: another high/critical risk submission
            assessment2 = WellnessAssessment(
                id=uuid.uuid4(),
                pseudonymous_id=test_pid,
                submitted_at=datetime.datetime.now(datetime.timezone.utc),
                mood_score=1,
                sleep_quality_score=1,
                stress_self_rating=10,
                help_requested=True,
            )
            self.db.add(assessment2)
            self.db.commit()

            # Second consecutive computation
            res2 = compute_risk(test_pid, db=self.db, save_to_db=True)
            score2_id = uuid.UUID(res2["risk_score_id"])
            self.assertNotEqual(score1_id, score2_id)

            # Check open alerts again: MUST still be exactly 1 open alert
            open_alerts_2 = (
                self.db.query(Alert)
                .join(RiskScore, Alert.risk_score_id == RiskScore.id)
                .filter(RiskScore.pseudonymous_id == test_pid, Alert.status == "open")
                .all()
            )
            self.assertEqual(len(open_alerts_2), 1, "Expected exactly 1 open alert after consecutive computations")

            # Check that the existing alert was updated to point to the newest risk score
            updated_alert = open_alerts_2[0]
            self.assertEqual(updated_alert.id, initial_alert_id)
            self.assertEqual(updated_alert.risk_score_id, score2_id)
            self.assertEqual(updated_alert.severity, "critical")

        finally:
            self.db.execute(text("DELETE FROM analytics.alerts WHERE risk_score_id IN (SELECT id FROM analytics.risk_scores WHERE pseudonymous_id = :pid)"), {"pid": test_pid})
            self.db.execute(text("DELETE FROM analytics.recommendations WHERE risk_score_id IN (SELECT id FROM analytics.risk_scores WHERE pseudonymous_id = :pid)"), {"pid": test_pid})
            self.db.execute(text("DELETE FROM analytics.risk_scores WHERE pseudonymous_id = :pid"), {"pid": test_pid})
            self.db.execute(text("DELETE FROM analytics.wellness_assessments WHERE pseudonymous_id = :pid"), {"pid": test_pid})
            self.db.execute(text("DELETE FROM identity.personnel WHERE pseudonymous_id = :pid"), {"pid": test_pid})
            self.db.commit()

    def test_resolved_alert_allows_new_open_alert(self):
        """Validates that if an alert is resolved, a subsequent high risk creates a new open alert."""
        test_sn = f"SN-ALERT-RESOLVED-{uuid.uuid4().hex[:6].upper()}"
        test_pid = uuid.uuid4()
        person = Personnel(
            service_number=test_sn,
            password_hash="test_hash",
            pseudonymous_id=test_pid,
            active=True,
        )
        self.db.add(person)
        self.db.commit()

        try:
            # Trigger first high-risk computation
            assessment1 = WellnessAssessment(
                id=uuid.uuid4(),
                pseudonymous_id=test_pid,
                submitted_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=7),
                mood_score=1,
                sleep_quality_score=1,
                stress_self_rating=9,
                help_requested=True,
            )
            self.db.add(assessment1)
            self.db.commit()

            res1 = compute_risk(test_pid, db=self.db, save_to_db=True)
            alert1 = (
                self.db.query(Alert)
                .join(RiskScore, Alert.risk_score_id == RiskScore.id)
                .filter(RiskScore.pseudonymous_id == test_pid, Alert.status == "open")
                .first()
            )
            self.assertIsNotNone(alert1)

            # Welfare officer resolves alert1
            alert1.status = "resolved"
            self.db.commit()

            # Trigger second high-risk computation later
            assessment2 = WellnessAssessment(
                id=uuid.uuid4(),
                pseudonymous_id=test_pid,
                submitted_at=datetime.datetime.now(datetime.timezone.utc),
                mood_score=1,
                sleep_quality_score=1,
                stress_self_rating=10,
                help_requested=True,
            )
            self.db.add(assessment2)
            self.db.commit()

            res2 = compute_risk(test_pid, db=self.db, save_to_db=True)
            all_alerts = (
                self.db.query(Alert)
                .join(RiskScore, Alert.risk_score_id == RiskScore.id)
                .filter(RiskScore.pseudonymous_id == test_pid)
                .all()
            )
            # Should have 2 total alerts: 1 resolved and 1 open
            self.assertEqual(len(all_alerts), 2)
            open_alerts = [a for a in all_alerts if a.status == "open"]
            resolved_alerts = [a for a in all_alerts if a.status == "resolved"]
            self.assertEqual(len(open_alerts), 1)
            self.assertEqual(len(resolved_alerts), 1)

        finally:
            self.db.execute(text("DELETE FROM analytics.alerts WHERE risk_score_id IN (SELECT id FROM analytics.risk_scores WHERE pseudonymous_id = :pid)"), {"pid": test_pid})
            self.db.execute(text("DELETE FROM analytics.recommendations WHERE risk_score_id IN (SELECT id FROM analytics.risk_scores WHERE pseudonymous_id = :pid)"), {"pid": test_pid})
            self.db.execute(text("DELETE FROM analytics.risk_scores WHERE pseudonymous_id = :pid"), {"pid": test_pid})
            self.db.execute(text("DELETE FROM analytics.wellness_assessments WHERE pseudonymous_id = :pid"), {"pid": test_pid})
            self.db.execute(text("DELETE FROM identity.personnel WHERE pseudonymous_id = :pid"), {"pid": test_pid})
            self.db.commit()

    def test_get_alerts_queue_endpoint_rbac_and_filtering(self):
        """
        Phase 7.3 Done When:
        Building GET /alerts (welfare_officer, admin only).
        Validates RBAC restrictions and status/severity filter parameters.
        """
        from fastapi.testclient import TestClient
        from app.jwt_auth import create_access_token
        from app.main import app

        client = TestClient(app)

        # Generate tokens
        welfare_token = create_access_token(
            person_id=str(uuid.uuid4()),
            pseudonymous_id=str(uuid.uuid4()),
            role="welfare_officer",
        )
        personnel_token = create_access_token(
            person_id=str(uuid.uuid4()),
            pseudonymous_id=str(uuid.uuid4()),
            role="personnel",
        )

        # 1. Personnel cannot access GET /alerts -> 403 Forbidden
        resp_p = client.get("/alerts", headers={"Authorization": f"Bearer {personnel_token}"})
        self.assertEqual(resp_p.status_code, 403)

        # 2. Welfare officer can access GET /alerts -> 200 OK
        resp_w = client.get("/alerts", headers={"Authorization": f"Bearer {welfare_token}"})
        self.assertEqual(resp_w.status_code, 200)
        self.assertIsInstance(resp_w.json(), list)

        # 3. Create test personnel and alert
        test_sn = f"SN-ALERT-QUEUE-{uuid.uuid4().hex[:6].upper()}"
        test_pid = uuid.uuid4()
        person = Personnel(
            service_number=test_sn,
            password_hash="test_hash",
            pseudonymous_id=test_pid,
            active=True,
        )
        self.db.add(person)
        self.db.commit()

        try:
            assessment = WellnessAssessment(
                id=uuid.uuid4(),
                pseudonymous_id=test_pid,
                submitted_at=datetime.datetime.now(datetime.timezone.utc),
                mood_score=1,
                sleep_quality_score=1,
                stress_self_rating=10,
                help_requested=True,
            )
            self.db.add(assessment)
            self.db.commit()

            res = compute_risk(test_pid, db=self.db, save_to_db=True)
            self.assertEqual(res["risk_category"], "critical")

            # Query queue via API
            resp_queue = client.get("/alerts?status=open", headers={"Authorization": f"Bearer {welfare_token}"})
            self.assertEqual(resp_queue.status_code, 200)
            queue_data = resp_queue.json()

            matched = [a for a in queue_data if a.get("pseudonymous_id") == str(test_pid)]
            self.assertEqual(len(matched), 1)
            alert_item = matched[0]
            self.assertEqual(alert_item["status"], "open")
            self.assertEqual(alert_item["severity"], "critical")
            self.assertGreaterEqual(alert_item["calibrated_score"], 85)
            self.assertIsNotNone(alert_item["contributing_factors"])

        finally:
            self.db.execute(text("DELETE FROM analytics.alerts WHERE risk_score_id IN (SELECT id FROM analytics.risk_scores WHERE pseudonymous_id = :pid)"), {"pid": test_pid})
            self.db.execute(text("DELETE FROM analytics.recommendations WHERE risk_score_id IN (SELECT id FROM analytics.risk_scores WHERE pseudonymous_id = :pid)"), {"pid": test_pid})
            self.db.execute(text("DELETE FROM analytics.risk_scores WHERE pseudonymous_id = :pid"), {"pid": test_pid})
            self.db.execute(text("DELETE FROM analytics.wellness_assessments WHERE pseudonymous_id = :pid"), {"pid": test_pid})
            self.db.execute(text("DELETE FROM identity.personnel WHERE pseudonymous_id = :pid"), {"pid": test_pid})
            self.db.commit()

    def test_send_alert_email_functionality(self):
        """
        Phase 7.3: Validates send_alert_email function structure, parameters,
        and graceful handling when test SMTP server is simulated.
        """
        from unittest.mock import MagicMock, patch
        from app.mailer import send_alert_email

        test_alert_id = uuid.uuid4()
        test_pid = uuid.uuid4()

        with patch("smtplib.SMTP") as mock_smtp:
            mock_instance = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_instance

            # Send email
            sent = send_alert_email(
                alert_id=test_alert_id,
                pseudonymous_id=test_pid,
                severity="critical",
                calibrated_score=92,
                contributing_factors=["Explicit request for welfare assistance", "Prolonged deployment"],
                recipient_email="duty_officer@welfare.mil",
                smtp_host="localhost",
                smtp_port=1025,
            )

            self.assertTrue(sent)
            mock_smtp.assert_called_with("localhost", 1025, timeout=5)
            self.assertTrue(mock_instance.sendmail.called)

            args, kwargs = mock_instance.sendmail.call_args
            from_addr, to_addrs, msg_str = args
            self.assertEqual(to_addrs, ["duty_officer@welfare.mil"])
            self.assertIn("CRITICAL ALERT", msg_str)
            self.assertIn(str(test_pid), msg_str)
            self.assertIn("Explicit request for welfare assistance", msg_str)


if __name__ == "__main__":
    unittest.main()

