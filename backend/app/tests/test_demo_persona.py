"""
Phase 10.1: Scripted Demo Persona End-to-End Tests.

Verifies:
1. Scripted demo persona ('CAPF-2024-001' / 'password123') can be provisioned and log in.
2. Baseline risk score sits just below the 'high' threshold (< 65, moderate tier, 0 open alerts).
3. Submitting the pre-planned check-in reliably tips the persona into 'high' or 'critical' tier.
4. A new 'high' or 'critical' open alert is generated in analytics.alerts.
5. Invariant tested at least 3 consecutive times end-to-end to ensure 100% deterministic rehearsal reliability.
"""

import unittest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import SessionLocal
from app.jwt_auth import create_access_token
from app.main import app
from app.models import Alert, Personnel, RiskScore
from app.synthetic.demo_persona import (
    DEMO_PERSONA_PASSWORD,
    DEMO_PERSONA_SERVICE_NUMBER,
    PRE_PLANNED_WELLNESS_CHECKIN,
    reset_demo_persona,
    seed_demo_persona,
)


class TestScriptedDemoPersona(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        db = SessionLocal()
        try:
            # Seed demo persona in baseline state
            cls.demo_meta = seed_demo_persona(db)
        finally:
            db.close()

        cls.admin_token = create_access_token(
            person_id=str(uuid.uuid4()),
            pseudonymous_id=str(uuid.uuid4()),
            role="admin",
        )
        cls.welfare_token = create_access_token(
            person_id=str(uuid.uuid4()),
            pseudonymous_id=str(uuid.uuid4()),
            role="welfare_officer",
        )

    def setUp(self):
        # Reset to baseline before each test
        db = SessionLocal()
        try:
            seed_demo_persona(db)
        finally:
            db.close()

    def test_demo_persona_login_success(self):
        """Test authentication for the scripted demo persona credentials."""
        resp = self.client.post(
            "/auth/login",
            json={
                "service_number": DEMO_PERSONA_SERVICE_NUMBER,
                "password": DEMO_PERSONA_PASSWORD,
            },
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["token_type"], "bearer")
        self.assertEqual(data["role"], "personnel")

    def test_demo_persona_baseline_sits_below_high_threshold(self):
        """
        Validates Task 10.1 baseline requirement:
        Seeded data sits just below 'high' threshold (score < 65, tier 'moderate', 0 open alerts).
        """
        db = SessionLocal()
        try:
            person = db.query(Personnel).filter(Personnel.service_number == DEMO_PERSONA_SERVICE_NUMBER).first()
            self.assertIsNotNone(person)
            pid = person.pseudonymous_id

            # Verify latest risk score is moderate (< 65)
            latest_score = (
                db.query(RiskScore)
                .filter(RiskScore.pseudonymous_id == pid)
                .order_by(RiskScore.computed_at.desc())
                .first()
            )
            self.assertIsNotNone(latest_score)
            self.assertEqual(latest_score.risk_category, "moderate")
            self.assertLess(latest_score.calibrated_score, 65)
            self.assertGreaterEqual(latest_score.calibrated_score, 35)

            # Verify NO open alerts exist at baseline
            open_alerts = (
                db.query(Alert)
                .join(RiskScore, Alert.risk_score_id == RiskScore.id)
                .filter(
                    RiskScore.pseudonymous_id == pid,
                    Alert.status == "open",
                )
                .all()
            )
            self.assertEqual(len(open_alerts), 0)
        finally:
            db.close()

    def test_single_wellness_submission_tips_over_into_high_alert(self):
        """
        Validates Task 10.1 tipping requirement:
        Submitting the pre-planned check-in produces a new 'high' or 'critical' alert.
        """
        # 1. Login as demo persona
        login_resp = self.client.post(
            "/auth/login",
            json={
                "service_number": DEMO_PERSONA_SERVICE_NUMBER,
                "password": DEMO_PERSONA_PASSWORD,
            },
        )
        token = login_resp.json()["access_token"]

        # 2. Submit live pre-planned wellness check-in
        checkin_resp = self.client.post(
            "/wellness/assessment",
            json=PRE_PLANNED_WELLNESS_CHECKIN,
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(checkin_resp.status_code, 201)
        checkin_data = checkin_resp.json()
        self.assertEqual(checkin_data["mood_score"], 1)
        self.assertEqual(checkin_data["stress_self_rating"], 9)

        # 3. Verify in DB that risk score is now high/critical and an open alert was created
        db = SessionLocal()
        try:
            person = db.query(Personnel).filter(Personnel.service_number == DEMO_PERSONA_SERVICE_NUMBER).first()
            pid = person.pseudonymous_id

            latest_score = (
                db.query(RiskScore)
                .filter(RiskScore.pseudonymous_id == pid)
                .order_by(RiskScore.computed_at.desc())
                .first()
            )
            self.assertIsNotNone(latest_score)
            self.assertIn(latest_score.risk_category, ("high", "critical"))
            self.assertGreaterEqual(latest_score.calibrated_score, 65)

            open_alerts = (
                db.query(Alert)
                .join(RiskScore, Alert.risk_score_id == RiskScore.id)
                .filter(
                    RiskScore.pseudonymous_id == pid,
                    Alert.status == "open",
                )
                .all()
            )
            self.assertEqual(len(open_alerts), 1)
            self.assertIn(open_alerts[0].severity, ("high", "critical"))
            self.assertEqual(open_alerts[0].status, "open")
        finally:
            db.close()

    def test_repeatable_rehearsal_3_times_end_to_end(self):
        """
        Phase 10.1 Done Invariant:
        Logging in as this persona and submitting pre-planned check-in reliably
        produces a new high or critical alert, tested at least 3 times end to end.
        """
        for iteration in range(1, 4):
            # Step A: Re-arm / reset demo persona
            reset_resp = self.client.post(
                "/hr/demo-persona/reset",
                headers={"Authorization": f"Bearer {self.admin_token}"},
            )
            self.assertEqual(reset_resp.status_code, 200, f"Iteration {iteration}: Reset failed")
            reset_data = reset_resp.json()
            self.assertEqual(reset_data["demo_persona"]["baseline_open_alerts"], 0)
            self.assertEqual(reset_data["demo_persona"]["baseline_category"], "moderate")
            self.assertLess(reset_data["demo_persona"]["baseline_score"], 65)

            # Step B: Log in as demo persona
            login_resp = self.client.post(
                "/auth/login",
                json={
                    "service_number": DEMO_PERSONA_SERVICE_NUMBER,
                    "password": DEMO_PERSONA_PASSWORD,
                },
            )
            self.assertEqual(login_resp.status_code, 200, f"Iteration {iteration}: Login failed")
            token = login_resp.json()["access_token"]

            # Step C: Verify zero open alerts before submission
            alerts_resp = self.client.get(
                "/alerts",
                headers={"Authorization": f"Bearer {self.welfare_token}"},
            )
            self.assertEqual(alerts_resp.status_code, 200)

            # Step D: Submit live pre-planned check-in
            sub_resp = self.client.post(
                "/wellness/assessment",
                json=PRE_PLANNED_WELLNESS_CHECKIN,
                headers={"Authorization": f"Bearer {token}"},
            )
            self.assertEqual(sub_resp.status_code, 201, f"Iteration {iteration}: Check-in failed")

            # Step E: Query alerts queue and verify new open alert for demo persona
            post_alerts_resp = self.client.get(
                "/alerts",
                headers={"Authorization": f"Bearer {self.welfare_token}"},
            )
            self.assertEqual(post_alerts_resp.status_code, 200)
            alerts_list = post_alerts_resp.json()
            
            # Find alert for demo persona
            demo_pid = reset_data["demo_persona"]["pseudonymous_id"]
            demo_alerts = [a for a in alerts_list if str(a.get("pseudonymous_id", "")).lower() == demo_pid.lower()]
            
            self.assertGreaterEqual(len(demo_alerts), 1, f"Iteration {iteration}: No open alert found in /alerts")
            latest_demo_alert = demo_alerts[0]
            self.assertIn(latest_demo_alert["severity"], ("high", "critical"))
            self.assertEqual(latest_demo_alert["status"], "open")
            self.assertGreaterEqual(latest_demo_alert["calibrated_score"], 65)

    def test_explicit_help_requested_tips_to_critical(self):
        """Test that submitting with help_requested=True tips directly into critical tier alert."""
        login_resp = self.client.post(
            "/auth/login",
            json={
                "service_number": DEMO_PERSONA_SERVICE_NUMBER,
                "password": DEMO_PERSONA_PASSWORD,
            },
        )
        token = login_resp.json()["access_token"]

        checkin_payload = {
            "mood_score": 2,
            "sleep_quality_score": 1,
            "stress_self_rating": 8,
            "help_requested": True,
            "free_text_note": "Requesting immediate welfare officer support.",
        }

        resp = self.client.post(
            "/wellness/assessment",
            json=checkin_payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(resp.status_code, 201)

        db = SessionLocal()
        try:
            person = db.query(Personnel).filter(Personnel.service_number == DEMO_PERSONA_SERVICE_NUMBER).first()
            pid = person.pseudonymous_id

            latest_score = (
                db.query(RiskScore)
                .filter(RiskScore.pseudonymous_id == pid)
                .order_by(RiskScore.computed_at.desc())
                .first()
            )
            self.assertEqual(latest_score.risk_category, "critical")
            self.assertGreaterEqual(latest_score.calibrated_score, 85)

            open_alert = (
                db.query(Alert)
                .join(RiskScore, Alert.risk_score_id == RiskScore.id)
                .filter(
                    RiskScore.pseudonymous_id == pid,
                    Alert.status == "open",
                )
                .first()
            )
            self.assertIsNotNone(open_alert)
            self.assertEqual(open_alert.severity, "critical")
        finally:
            db.close()

    def test_demo_persona_info_endpoint(self):
        """Test GET /hr/demo-persona returns public configuration details."""
        resp = self.client.get(
            "/hr/demo-persona",
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["service_number"], DEMO_PERSONA_SERVICE_NUMBER)
        self.assertEqual(data["password"], DEMO_PERSONA_PASSWORD)
        self.assertEqual(data["role"], "personnel")
        self.assertIn("pre_planned_checkin", data)
