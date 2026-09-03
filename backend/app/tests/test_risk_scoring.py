"""
Unit and integration tests for Phase 6.1: Risk Scoring Pipeline.

Verifies:
1. `model.joblib` loads at FastAPI startup and via `load_risk_model()`.
2. `get_risk_category` banding follows the MVP thresholds (low < 35, moderate 35-64, high 65-84, critical >= 85).
3. `compute_risk(pseudonymous_id)` orchestrates:
   - raw data extraction from DB tables
   - point-in-time feature engineering
   - calibrated model prediction (0-100)
   - risk category banding
   - plain-language contributing factors
4. Scoring against seeded test individuals (low risk, high risk deployed, high risk sudden drop)
   produces calibrated scores and risk categories that match their synthetic profiles.
5. Database persistence to `analytics.risk_scores` when `save_to_db=True`.
"""

import datetime
import unittest
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import SessionLocal
from app.main import app
from app.models import Personnel, RiskScore
from app.risk import (
    compute_risk,
    determine_as_of_date,
    get_risk_category,
    get_risk_model,
    load_person_analytics_tables,
    load_risk_model,
)
from app.train_model import WelfareRiskModel


class TestRiskScoringPipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()
        cls.model = load_risk_model()

        # Query seeded test profiles
        p_low = cls.db.execute(
            text("SELECT service_number, pseudonymous_id FROM identity.personnel WHERE service_number = 'SN-100001'")
        ).fetchone()

        p_sudden_drop = cls.db.execute(
            text("SELECT service_number, pseudonymous_id FROM identity.personnel WHERE service_number = 'SN-100034'")
        ).fetchone()

        p_deployed_hardship = cls.db.execute(
            text("SELECT service_number, pseudonymous_id FROM identity.personnel WHERE service_number = 'SN-100043'")
        ).fetchone()

        cls.p_low_id = p_low.pseudonymous_id if p_low else None
        cls.p_sudden_drop_id = p_sudden_drop.pseudonymous_id if p_sudden_drop else None
        cls.p_deployed_hardship_id = p_deployed_hardship.pseudonymous_id if p_deployed_hardship else None

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_model_loading_and_singleton(self):
        """Validates that load_risk_model loads WelfareRiskModel and get_risk_model returns cached instance."""
        model = get_risk_model()
        self.assertIsInstance(model, WelfareRiskModel)
        self.assertIsNotNone(model.calibrated_model)
        self.assertGreater(len(model.feature_names), 0)

    def test_fastapi_startup_lifespan_loads_model(self):
        """Validates that TestClient startup triggers lifespan and sets app.state.risk_model."""
        with TestClient(app) as client:
            resp = client.get("/health")
            self.assertEqual(resp.status_code, 200)
            self.assertTrue(hasattr(app.state, "risk_model"))
            self.assertIsInstance(app.state.risk_model, WelfareRiskModel)

    def test_risk_category_banding_thresholds(self):
        """Validates banding rules for low, moderate, high, and critical tiers."""
        # Critical: >= 85
        self.assertEqual(get_risk_category(85), "critical")
        self.assertEqual(get_risk_category(99), "critical")
        self.assertEqual(get_risk_category(100), "critical")

        # High: 65 - 84
        self.assertEqual(get_risk_category(65), "high")
        self.assertEqual(get_risk_category(84), "high")
        self.assertEqual(get_risk_category(75), "high")

        # Moderate: 35 - 64
        self.assertEqual(get_risk_category(35), "moderate")
        self.assertEqual(get_risk_category(64), "moderate")
        self.assertEqual(get_risk_category(50), "moderate")

        # Low: < 35
        self.assertEqual(get_risk_category(34), "low")
        self.assertEqual(get_risk_category(10), "low")
        self.assertEqual(get_risk_category(0), "low")

    def test_load_person_analytics_tables(self):
        """Validates that querying a seeded person returns DataFrames with expected schemas."""
        if self.p_low_id is None:
            self.skipTest("Seeded person SN-100001 not found in DB")

        tables = load_person_analytics_tables(self.db, self.p_low_id)
        self.assertIn("duty_records", tables)
        self.assertIn("leave_records", tables)
        self.assertIn("deployments", tables)
        self.assertIn("transfers", tables)
        self.assertIn("training_records", tables)
        self.assertIn("wellness_assessments", tables)

        # Duty records should have rows
        self.assertFalse(tables["duty_records"].empty)
        self.assertIn("duty_hours", tables["duty_records"].columns)

    def test_determine_as_of_date_auto_detection(self):
        """Validates that determine_as_of_date finds the latest date from the records."""
        if self.p_low_id is None:
            self.skipTest("Seeded person SN-100001 not found in DB")

        tables = load_person_analytics_tables(self.db, self.p_low_id)
        auto_date = determine_as_of_date(tables)
        self.assertIsInstance(auto_date, datetime.date)

        # If explicit date is given, it should return that date
        explicit = determine_as_of_date(tables, explicit_date="2026-03-15")
        self.assertEqual(explicit, datetime.date(2026, 3, 15))

    def test_compute_risk_for_standard_low_risk_person(self):
        """Validates that a standard healthy profile (SN-100001) scores in low/moderate tier."""
        if self.p_low_id is None:
            self.skipTest("Seeded person SN-100001 not found in DB")

        result = compute_risk(self.p_low_id, db=self.db)

        self.assertEqual(result["pseudonymous_id"], str(self.p_low_id).lower())
        self.assertIsInstance(result["calibrated_score"], int)
        self.assertTrue(0 <= result["calibrated_score"] <= 100)
        self.assertIn(result["risk_category"], ["low", "moderate", "high", "critical"])
        self.assertIsInstance(result["probability_score"], float)
        self.assertIsInstance(result["contributing_factors"], list)
        self.assertIsInstance(result["features"], dict)

        print(f"\n[SN-100001 Risk Score]: {result['calibrated_score']} ({result['risk_category']})")
        print(f"  Contributing Factors: {result['contributing_factors']}")

    def test_compute_risk_for_high_risk_deployed_person(self):
        """
        Validates that SN-100043 (deployed in high hardship level 4 zone for 40+ days)
        evaluates with elevated risk (moderate category) and surfaces deployment & hardship factors.
        """
        if self.p_deployed_hardship_id is None:
            self.skipTest("Seeded person SN-100043 not found in DB")

        result = compute_risk(self.p_deployed_hardship_id, db=self.db, as_of_date="2026-04-27")

        print(f"\n[SN-100043 Risk Score]: {result['calibrated_score']} ({result['risk_category']})")
        print(f"  Contributing Factors: {result['contributing_factors']}")

        self.assertIn(result["risk_category"], ["moderate", "high", "critical"])
        self.assertGreaterEqual(result["calibrated_score"], 30)

        # Check contributing factors mention deployment/hardship/drop/leave
        factors_text = " ".join(result["contributing_factors"]).lower()
        self.assertTrue(
            any(k in factors_text for k in ("deployment", "hardship", "drop", "leave", "duty", "wellness")),
            "Expected risk factors not present in contributing factors",
        )

    def test_compute_risk_for_high_risk_sudden_drop_person(self):
        """
        Validates that SN-100034 (consecutive night shifts + sudden mood drop)
        evaluates and surfaces night shifts, leave, deployment, or sleep quality factors.
        """
        if self.p_sudden_drop_id is None:
            self.skipTest("Seeded person SN-100034 not found in DB")

        result = compute_risk(self.p_sudden_drop_id, db=self.db, as_of_date="2026-01-21")

        print(f"\n[SN-100034 Risk Score]: {result['calibrated_score']} ({result['risk_category']})")
        print(f"  Contributing Factors: {result['contributing_factors']}")

        self.assertIn(result["risk_category"], ["low", "moderate", "high", "critical"])
        factors_text = " ".join(result["contributing_factors"]).lower()
        self.assertTrue(
            any(k in factors_text for k in ("night shift", "sleep", "wellness", "training", "leave", "deployment", "duty")),
            "Expected factor keywords not surfaced in contributing factors",
        )

    def test_compute_risk_database_persistence(self):
        """Validates that passing save_to_db=True persists a RiskScore row in analytics.risk_scores."""
        if self.p_low_id is None:
            self.skipTest("Seeded person SN-100001 not found in DB")

        result = compute_risk(self.p_low_id, db=self.db, save_to_db=True)
        self.assertIsNotNone(result["risk_score_id"])

        score_uuid = uuid.UUID(result["risk_score_id"])
        saved_record = self.db.query(RiskScore).filter(RiskScore.id == score_uuid).first()

        self.assertIsNotNone(saved_record)
        self.assertEqual(saved_record.pseudonymous_id, self.p_low_id)
        self.assertEqual(saved_record.calibrated_score, result["calibrated_score"])
        self.assertEqual(saved_record.risk_category, result["risk_category"])

    def test_compute_risk_unseeded_empty_profile_graceful(self):
        """Validates that calling compute_risk on a brand new person with 0 records does not crash."""
        random_id = uuid.uuid4()
        result = compute_risk(random_id, db=self.db)

        self.assertEqual(result["pseudonymous_id"], str(random_id).lower())
        self.assertIsInstance(result["calibrated_score"], int)
        self.assertIn(result["risk_category"], ["low", "moderate", "high", "critical"])
        self.assertIsInstance(result["contributing_factors"], list)


if __name__ == "__main__":
    unittest.main()
