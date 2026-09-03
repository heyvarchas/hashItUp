"""
Phase 10.2: Full Walkthrough Test.

Runs the complete system lifecycle from start to finish, exactly as demoed:
1. Personnel login (CAPF-2024-001 / password123)
2. Live wellness check-in submission (mood=1, sleep=1, stress=9)
3. Officer login (CAPF-2024-002 / password456)
4. Officer views active alert in alerts queue
5. Officer opens case and views clinical recommendations & risk factors
6. Officer records clinical/supportive intervention and resolves/acknowledges alert
7. Unit summary and alert queue immediately reflect the update

Done when: Entire walkthrough completes end-to-end with zero manual DB edits or backend restarts.
"""

import unittest
import uuid
from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.main import app
from app.models import Alert, Intervention, Personnel, RiskScore
from app.synthetic.demo_persona import (
    DEMO_PERSONA_PASSWORD,
    DEMO_PERSONA_SERVICE_NUMBER,
    PRE_PLANNED_WELLNESS_CHECKIN,
    seed_demo_persona,
)


class TestFullWalkthrough(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        # Reset demo data to pristine baseline state before test
        db = SessionLocal()
        try:
            self.demo_meta = seed_demo_persona(db)
        finally:
            db.close()

    def test_complete_end_to_end_walkthrough(self):
        """
        Executes Task 10.2: Full Walkthrough flow:
        personnel login -> check-in -> officer sees alert -> officer opens case -> records intervention -> unit summary reflects change.
        """
        # =========================================================================
        # STEP 0: Initial State Verification
        # =========================================================================
        # Officer logs in to verify baseline unit summary
        officer_login_resp = self.client.post(
            "/auth/login",
            json={
                "service_number": "CAPF-2024-002",
                "password": "password456",
            },
        )
        self.assertEqual(officer_login_resp.status_code, 200, "Officer login failed")
        officer_token = officer_login_resp.json()["access_token"]
        self.assertEqual(officer_login_resp.json()["role"], "welfare_officer")

        # Baseline unit summary check
        baseline_summary_resp = self.client.get(
            "/dashboard/unit-summary",
            headers={"Authorization": f"Bearer {officer_token}"},
        )
        self.assertEqual(baseline_summary_resp.status_code, 200)
        baseline_summary = baseline_summary_resp.json()
        initial_open_alerts = baseline_summary["open_alerts_count"]

        # =========================================================================
        # STEP 1: Personnel Login
        # =========================================================================
        personnel_login_resp = self.client.post(
            "/auth/login",
            json={
                "service_number": DEMO_PERSONA_SERVICE_NUMBER,
                "password": DEMO_PERSONA_PASSWORD,
            },
        )
        self.assertEqual(personnel_login_resp.status_code, 200, "Personnel login failed")
        personnel_data = personnel_login_resp.json()
        personnel_token = personnel_data["access_token"]
        self.assertEqual(personnel_data["role"], "personnel")

        # =========================================================================
        # STEP 2: Live Wellness Check-in Submission
        # =========================================================================
        checkin_resp = self.client.post(
            "/wellness/assessment",
            json=PRE_PLANNED_WELLNESS_CHECKIN,
            headers={"Authorization": f"Bearer {personnel_token}"},
        )
        self.assertEqual(checkin_resp.status_code, 201, "Wellness check-in failed")
        checkin_data = checkin_resp.json()
        self.assertEqual(checkin_data["mood_score"], 1)
        self.assertEqual(checkin_data["sleep_quality_score"], 1)
        self.assertEqual(checkin_data["stress_self_rating"], 9)
        assessment_id = checkin_data["id"]
        demo_pid = checkin_data["pseudonymous_id"]

        # =========================================================================
        # STEP 3: Officer Sees Alert
        # =========================================================================
        alerts_resp = self.client.get(
            "/alerts",
            headers={"Authorization": f"Bearer {officer_token}"},
        )
        self.assertEqual(alerts_resp.status_code, 200, "Failed to fetch alerts queue")
        alerts_list = alerts_resp.json()

        # Locate the new alert for our demo persona
        matching_alerts = [
            a for a in alerts_list
            if str(a.get("pseudonymous_id", "")).lower() == str(demo_pid).lower()
            and a["status"] == "open"
        ]
        self.assertEqual(len(matching_alerts), 1, "Expected exactly 1 open alert for demo persona")
        demo_alert = matching_alerts[0]
        alert_id = demo_alert["id"]
        risk_score_id = demo_alert["risk_score_id"]

        self.assertIn(demo_alert["severity"], ("high", "critical"))
        self.assertGreaterEqual(demo_alert["calibrated_score"], 65)

        # Unit summary should now reflect +1 open alert
        mid_summary_resp = self.client.get(
            "/dashboard/unit-summary",
            headers={"Authorization": f"Bearer {officer_token}"},
        )
        self.assertEqual(mid_summary_resp.status_code, 200)
        mid_summary = mid_summary_resp.json()
        self.assertEqual(mid_summary["open_alerts_count"], initial_open_alerts + 1)

        # =========================================================================
        # STEP 4: Officer Opens Case
        # =========================================================================
        # 4a. Fetch single alert detail
        alert_detail_resp = self.client.get(
            f"/alerts/{alert_id}",
            headers={"Authorization": f"Bearer {officer_token}"},
        )
        self.assertEqual(alert_detail_resp.status_code, 200)
        alert_detail = alert_detail_resp.json()
        self.assertEqual(alert_detail["id"], alert_id)
        self.assertEqual(alert_detail["status"], "open")

        # 4b. Fetch latest risk score + recommendations (Officer clinical drill-down)
        risk_latest_resp = self.client.get(
            f"/personnel/{demo_pid}/risk",
            headers={"Authorization": f"Bearer {officer_token}"},
        )
        self.assertEqual(risk_latest_resp.status_code, 200)
        risk_detail = risk_latest_resp.json()
        self.assertIn(risk_detail["risk_category"], ("high", "critical"))
        self.assertTrue(len(risk_detail.get("contributing_factors", [])) > 0)
        self.assertGreaterEqual(risk_detail["calibrated_score"], 65)

        # =========================================================================
        # STEP 5: Records Intervention
        # =========================================================================
        intervention_payload = {
            "alert_id": alert_id,
            "intervention_type": "psychological_counseling",
            "notes": "Initiated supportive psychological counseling and light duty reassignment.",
            "new_alert_status": "resolved",
        }
        intervention_resp = self.client.post(
            "/interventions",
            json=intervention_payload,
            headers={"Authorization": f"Bearer {officer_token}"},
        )
        self.assertEqual(intervention_resp.status_code, 201, "Failed to record intervention")
        intervention_data = intervention_resp.json()
        self.assertEqual(intervention_data["alert_id"], alert_id)
        self.assertEqual(intervention_data["intervention_type"], "psychological_counseling")
        self.assertEqual(intervention_data["alert_status"], "resolved")

        # Verify alert status is now 'resolved'
        updated_alert_resp = self.client.get(
            f"/alerts/{alert_id}",
            headers={"Authorization": f"Bearer {officer_token}"},
        )
        self.assertEqual(updated_alert_resp.status_code, 200)
        self.assertEqual(updated_alert_resp.json()["status"], "resolved")

        # =========================================================================
        # STEP 6: Unit Summary Reflects the Change
        # =========================================================================
        post_summary_resp = self.client.get(
            "/dashboard/unit-summary",
            headers={"Authorization": f"Bearer {officer_token}"},
        )
        self.assertEqual(post_summary_resp.status_code, 200)
        post_summary = post_summary_resp.json()

        # Open alerts count decreased back down
        self.assertEqual(post_summary["open_alerts_count"], initial_open_alerts)

        # Verify intervention history is logged
        history_resp = self.client.get(
            f"/interventions?alert_id={alert_id}",
            headers={"Authorization": f"Bearer {officer_token}"},
        )
        self.assertEqual(history_resp.status_code, 200)
        history_list = history_resp.json()
        self.assertEqual(len(history_list), 1)
        self.assertEqual(history_list[0]["id"], intervention_data["id"])
