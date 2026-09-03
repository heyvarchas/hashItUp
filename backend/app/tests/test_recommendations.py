"""
Unit and integration tests for Phase 7.1: Recommendation Engine & Rule Evaluation.

Verifies:
1. RECOMMENDATION_RULES contains all 5 specialized rules + routine_monitoring fallback.
2. Distinct, sensible recommendations are returned across synthetic risk profiles:
   - Low risk profile: yields routine_monitoring (or appropriate healthy guidance).
   - Medium risk profile: yields leave_scheduling_intervention / routine checks without emergency check.
   - High/Critical risk profiles:
     - Help requested / critical risk: yields immediate_welfare_check.
     - Extended continuous duty / night shifts: yields mandatory_rest_period.
     - Sudden wellness drop / high stress: yields counseling_support_referral.
     - Extended continuous deployment: yields deployment_rotation_review.
3. Rationale strings are sensible, actionable, and non-empty.
4. Database persistence: compute_risk(..., save_to_db=True) persists matched recommendations
   to `analytics.recommendations` table linked to the `analytics.risk_scores` row.
"""

import datetime
import unittest
import uuid

from sqlalchemy import text

from app.db import SessionLocal
from app.models import Personnel, Recommendation, RiskScore, WellnessAssessment
from app.recommendations import (
    RECOMMENDATION_RULES,
    evaluate_recommendations,
)
from app.risk import compute_risk


class TestRecommendationEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_recommendation_rules_structure(self):
        """Validates that RECOMMENDATION_RULES defines valid rule dictionaries with callables and rationales."""
        self.assertGreaterEqual(len(RECOMMENDATION_RULES), 5)
        for rule in RECOMMENDATION_RULES:
            self.assertIn("type", rule)
            self.assertIn("name", rule)
            self.assertIn("condition", rule)
            self.assertTrue(callable(rule["condition"]))
            self.assertIn("rationale", rule)
            self.assertIsInstance(rule["rationale"], str)

    def test_synthetic_profiles_return_distinct_sensible_recommendations(self):
        """
        Phase 7.1 Acceptance Criterion:
        Running evaluate_recommendations against 3 different synthetic risk profiles
        (low/medium/high) returns sensible, distinct recommendations for each.
        """
        # Profile 1: Low Risk (Healthy baseline)
        low_features = {
            "avg_duty_hours_4wk": 8.0,
            "total_duty_hours_4wk": 160.0,
            "consecutive_night_shifts": 0,
            "days_since_last_leave": 20.0,
            "deployment_duration_days": 0,
            "active_deployment_hardship": 0,
            "sudden_wellness_drop": 0,
            "latest_mood_score": 4,
            "latest_stress_self_rating": 2,
            "help_requested_recent": 0,
        }
        recs_low = evaluate_recommendations(low_features, risk_category="low", risk_score=15)
        low_types = [r["recommendation_type"] for r in recs_low]

        self.assertIn("routine_monitoring", low_types)
        self.assertNotIn("immediate_welfare_check", low_types)
        self.assertNotIn("mandatory_rest_period", low_types)

        # Profile 2: Medium/Moderate Risk (Fatigue / Leave Deficit)
        med_features = {
            "avg_duty_hours_4wk": 10.0,
            "total_duty_hours_4wk": 210.0,
            "consecutive_night_shifts": 1,
            "days_since_last_leave": 110.0,  # >= 90 days triggers leave intervention
            "deployment_duration_days": 0,
            "active_deployment_hardship": 0,
            "sudden_wellness_drop": 0,
            "latest_mood_score": 3,
            "latest_stress_self_rating": 5,
            "help_requested_recent": 0,
        }
        recs_med = evaluate_recommendations(med_features, risk_category="moderate", risk_score=48)
        med_types = [r["recommendation_type"] for r in recs_med]

        self.assertIn("leave_scheduling_intervention", med_types)
        self.assertNotIn("immediate_welfare_check", med_types)
        self.assertNotIn("routine_monitoring", med_types)

        # Profile 3: High/Critical Risk (Acute Crisis / Hardship)
        high_features = {
            "avg_duty_hours_4wk": 15.5,  # triggers rest period
            "total_duty_hours_4wk": 280.0,
            "consecutive_night_shifts": 6,  # triggers rest period
            "days_since_last_leave": 140.0,  # triggers leave intervention
            "deployment_duration_days": 75.0,  # triggers deployment review
            "active_deployment_hardship": 4,
            "sudden_wellness_drop": 1,  # triggers counseling referral
            "latest_mood_score": 1,
            "latest_stress_self_rating": 9,
            "help_requested_recent": 1,  # triggers immediate welfare check
        }
        recs_high = evaluate_recommendations(high_features, risk_category="critical", risk_score=92)
        high_types = [r["recommendation_type"] for r in recs_high]

        self.assertIn("immediate_welfare_check", high_types)
        self.assertIn("mandatory_rest_period", high_types)
        self.assertIn("leave_scheduling_intervention", high_types)
        self.assertIn("counseling_support_referral", high_types)
        self.assertIn("deployment_rotation_review", high_types)

        # Ensure all 3 returned distinct recommendation sets
        self.assertNotEqual(set(low_types), set(med_types))
        self.assertNotEqual(set(med_types), set(high_types))
        self.assertNotEqual(set(low_types), set(high_types))

    def test_counseling_referral_triggers(self):
        """Validates that counseling referral triggers on sudden drop, low mood, or high stress."""
        # Triggered by sudden drop
        f_drop = {"sudden_wellness_drop": 1}
        recs_drop = evaluate_recommendations(f_drop, "moderate", 45)
        self.assertIn("counseling_support_referral", [r["recommendation_type"] for r in recs_drop])

        # Triggered by severe stress rating
        f_stress = {"latest_stress_self_rating": 9, "sudden_wellness_drop": 0}
        recs_stress = evaluate_recommendations(f_stress, "moderate", 45)
        self.assertIn("counseling_support_referral", [r["recommendation_type"] for r in recs_stress])

        # Triggered by low mood
        f_mood = {"latest_mood_score": 2, "sudden_wellness_drop": 0}
        recs_mood = evaluate_recommendations(f_mood, "moderate", 45)
        self.assertIn("counseling_support_referral", [r["recommendation_type"] for r in recs_mood])

    def test_deployment_review_triggers(self):
        """Validates deployment review triggers on prolonged deployment or high hardship duration."""
        # 60+ days deployment
        f_long = {"deployment_duration_days": 65}
        recs_long = evaluate_recommendations(f_long, "moderate", 40)
        self.assertIn("deployment_rotation_review", [r["recommendation_type"] for r in recs_long])

        # 30+ days in hardship level 4+
        f_hard = {"deployment_duration_days": 35, "active_deployment_hardship": 4}
        recs_hard = evaluate_recommendations(f_hard, "moderate", 40)
        self.assertIn("deployment_rotation_review", [r["recommendation_type"] for r in recs_hard])

    def test_database_persistence_with_compute_risk(self):
        """Validates that compute_risk(save_to_db=True) creates analytics.recommendations rows."""
        test_sn = f"SN-REC-{uuid.uuid4().hex[:6].upper()}"
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
            # Manually insert high-risk assessment
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

            # Execute compute_risk with save_to_db=True
            res = compute_risk(test_pid, db=self.db, save_to_db=True)
            self.assertIsNotNone(res["risk_score_id"])
            self.assertIn("recommendations", res)
            self.assertGreater(len(res["recommendations"]), 0)

            score_id = uuid.UUID(res["risk_score_id"])

            # Query database recommendations
            db_recs = (
                self.db.query(Recommendation)
                .filter(Recommendation.risk_score_id == score_id)
                .all()
            )
            self.assertGreater(len(db_recs), 0)

            rec_types = [r.recommendation_type for r in db_recs]
            self.assertIn("immediate_welfare_check", rec_types)

            for rec in db_recs:
                self.assertIsNotNone(rec.rationale)
                self.assertGreater(len(rec.rationale), 10)

        finally:
            self.db.execute(
                text(
                    "DELETE FROM analytics.alerts WHERE risk_score_id IN "
                    "(SELECT id FROM analytics.risk_scores WHERE pseudonymous_id = :pid)"
                ),
                {"pid": test_pid},
            )
            self.db.execute(
                text(
                    "DELETE FROM analytics.recommendations WHERE risk_score_id IN "
                    "(SELECT id FROM analytics.risk_scores WHERE pseudonymous_id = :pid)"
                ),
                {"pid": test_pid},
            )
            self.db.execute(text("DELETE FROM analytics.risk_scores WHERE pseudonymous_id = :pid"), {"pid": test_pid})
            self.db.execute(text("DELETE FROM analytics.wellness_assessments WHERE pseudonymous_id = :pid"), {"pid": test_pid})
            self.db.execute(text("DELETE FROM identity.personnel WHERE pseudonymous_id = :pid"), {"pid": test_pid})
            self.db.commit()



if __name__ == "__main__":
    unittest.main()
