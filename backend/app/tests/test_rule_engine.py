"""
Unit and integration tests for Phase 6.2: Rule Engine Layer.

Verifies:
1. Deterministic rule checks (help_requested, sudden_wellness_drop, days_since_last_leave, deployment_duration)
   strictly escalate categories and NEVER lower them.
2. An individual with raw 'low' model score and a manually-inserted `help_requested=True`
   wellness assessment gets forced to `critical` category.
3. Sudden wellness drop forces at least `high` category.
4. Extended absence of leave (>= 180d) forces at least `high` category.
5. Extended continuous deployment (>= 180d) forces `critical` category.
6. Rule flags dictionary records all triggered rule states.
"""

import datetime
import unittest
import uuid

from sqlalchemy import text

from app.db import SessionLocal
from app.models import Personnel, WellnessAssessment
from app.risk import compute_risk
from app.rules import (
    CATEGORY_RANK,
    CATEGORY_MIN_SCORE,
    evaluate_deterministic_rules,
)


class TestRuleEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_help_requested_forces_critical(self):
        """Validates that help_requested=True forces escalation to critical from low/moderate/high."""
        features = {
            "help_requested_recent": 1,
            "sudden_wellness_drop": 0,
            "days_since_last_leave": 10.0,
            "deployment_duration_days": 0,
        }
        res = evaluate_deterministic_rules(features, raw_category="low", raw_score=12)

        self.assertEqual(res["final_category"], "critical")
        self.assertGreaterEqual(res["final_score"], 85)
        self.assertTrue(res["escalated"])
        self.assertTrue(res["rule_flags"]["help_requested"])
        self.assertIn("forced escalation to critical", " ".join(res["triggered_reasons"]))

    def test_sudden_wellness_drop_forces_high(self):
        """Validates that sudden_wellness_drop=1 forces category to at least high."""
        features = {
            "help_requested_recent": 0,
            "sudden_wellness_drop": 1,
            "days_since_last_leave": 20.0,
            "deployment_duration_days": 0,
        }
        res = evaluate_deterministic_rules(features, raw_category="low", raw_score=15)

        self.assertEqual(res["final_category"], "high")
        self.assertGreaterEqual(res["final_score"], 65)
        self.assertTrue(res["escalated"])
        self.assertTrue(res["rule_flags"]["sudden_wellness_drop"])

    def test_days_since_last_leave_escalation_thresholds(self):
        """Validates 180d -> high and 90d -> moderate escalations."""
        # 180 days -> High
        feat_180 = {"days_since_last_leave": 195.0, "sudden_wellness_drop": 0, "help_requested_recent": 0, "deployment_duration_days": 0}
        res_180 = evaluate_deterministic_rules(feat_180, raw_category="low", raw_score=10)
        self.assertEqual(res_180["final_category"], "high")
        self.assertGreaterEqual(res_180["final_score"], 65)
        self.assertTrue(res_180["rule_flags"]["days_since_last_leave"])

        # 90 days -> Moderate
        feat_90 = {"days_since_last_leave": 95.0, "sudden_wellness_drop": 0, "help_requested_recent": 0, "deployment_duration_days": 0}
        res_90 = evaluate_deterministic_rules(feat_90, raw_category="low", raw_score=10)
        self.assertEqual(res_90["final_category"], "moderate")
        self.assertGreaterEqual(res_90["final_score"], 35)

    def test_deployment_duration_escalation_thresholds(self):
        """Validates 180d -> critical, 90d -> high, 60d -> moderate escalations."""
        # 180 days -> Critical
        feat_180 = {"deployment_duration_days": 200, "days_since_last_leave": 0, "sudden_wellness_drop": 0, "help_requested_recent": 0}
        res_180 = evaluate_deterministic_rules(feat_180, raw_category="low", raw_score=15)
        self.assertEqual(res_180["final_category"], "critical")
        self.assertGreaterEqual(res_180["final_score"], 85)

        # 90 days -> High
        feat_90 = {"deployment_duration_days": 100, "days_since_last_leave": 0, "sudden_wellness_drop": 0, "help_requested_recent": 0}
        res_90 = evaluate_deterministic_rules(feat_90, raw_category="low", raw_score=15)
        self.assertEqual(res_90["final_category"], "high")

        # 60 days -> Moderate
        feat_60 = {"deployment_duration_days": 65, "days_since_last_leave": 0, "sudden_wellness_drop": 0, "help_requested_recent": 0}
        res_60 = evaluate_deterministic_rules(feat_60, raw_category="low", raw_score=15)
        self.assertEqual(res_60["final_category"], "moderate")

    def test_rules_never_lower_category_invariant(self):
        """Validates the core invariant: rules can only escalate category, never lower it."""
        clean_features = {
            "help_requested_recent": 0,
            "sudden_wellness_drop": 0,
            "days_since_last_leave": 5.0,
            "deployment_duration_days": 0,
        }
        # If ML model predicted critical, it MUST remain critical
        res_crit = evaluate_deterministic_rules(clean_features, raw_category="critical", raw_score=92)
        self.assertEqual(res_crit["final_category"], "critical")
        self.assertEqual(res_crit["final_score"], 92)
        self.assertFalse(res_crit["escalated"])

        # If ML model predicted high, it MUST remain high
        res_high = evaluate_deterministic_rules(clean_features, raw_category="high", raw_score=72)
        self.assertEqual(res_high["final_category"], "high")
        self.assertEqual(res_high["final_score"], 72)
        self.assertFalse(res_high["escalated"])

    def test_integration_manually_inserted_help_requested_forces_critical(self):
        """
        Phase 6.2 Acceptance Criterion:
        A test person with a manually-inserted 'help_requested=True' assessment
        gets forced to 'critical' regardless of what the raw model score says.
        """
        # Create a dedicated test personnel record
        test_sn = f"SN-TEST-{uuid.uuid4().hex[:6].upper()}"
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
            # Baseline test: person with no records scores 'low' by default
            baseline = compute_risk(test_pid, db=self.db)
            self.assertEqual(baseline["raw_risk_category"], "low")
            self.assertEqual(baseline["risk_category"], "low")
            self.assertFalse(baseline["escalated_by_rules"])

            # Manually insert a wellness assessment with help_requested=True
            today = datetime.date.today()
            assessment = WellnessAssessment(
                id=uuid.uuid4(),
                pseudonymous_id=test_pid,
                submitted_at=datetime.datetime.now(datetime.timezone.utc),
                mood_score=4,  # healthy mood, would normally predict low risk
                sleep_quality_score=4,
                stress_self_rating=2,
                help_requested=True,  # Safety trigger
            )
            self.db.add(assessment)
            self.db.commit()

            # Now compute risk
            scored = compute_risk(test_pid, db=self.db, save_to_db=True)

            print(f"\n[Help Requested Override Test for {test_sn}]:")
            print(f"  Raw ML Category    : {scored['raw_risk_category']} (score: {scored['raw_calibrated_score']})")
            print(f"  Final Risk Category: {scored['risk_category']} (score: {scored['calibrated_score']})")
            print(f"  Escalated By Rules : {scored['escalated_by_rules']}")
            print(f"  Rule Flags         : {scored['rule_flags']}")
            print(f"  Contributing Factors: {scored['contributing_factors']}")

            # Assertions
            self.assertEqual(scored["risk_category"], "critical")
            self.assertTrue(scored["escalated_by_rules"])
            self.assertTrue(scored["rule_flags"]["help_requested"])
            self.assertGreaterEqual(scored["calibrated_score"], 85)
            self.assertTrue(scored["welfare_concern_30d"])

            # Contributing factors should include the help request reason
            factors_text = " ".join(scored["contributing_factors"]).lower()
            self.assertTrue("help" in factors_text or "assistance" in factors_text)

        finally:
            # Cleanup test records
            self.db.execute(text("DELETE FROM analytics.risk_scores WHERE pseudonymous_id = :pid"), {"pid": test_pid})
            self.db.execute(text("DELETE FROM analytics.wellness_assessments WHERE pseudonymous_id = :pid"), {"pid": test_pid})
            self.db.execute(text("DELETE FROM identity.personnel WHERE pseudonymous_id = :pid"), {"pid": test_pid})
            self.db.commit()


if __name__ == "__main__":
    unittest.main()
