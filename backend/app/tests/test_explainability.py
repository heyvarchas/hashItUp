"""
Unit and validation tests for Phase 5.4: Feature-Importance & Plain-Language Explanations.

Verifies:
1. `get_top_contributing_factors` computes the top 3 features most deviated from population median.
2. Plain-language strings match the injected trajectory events for known high-risk individuals.
3. Integrated into `WelfareRiskModel.predict_risk_score` returning `contributing_factors`.
"""

import unittest
from pathlib import Path

import pandas as pd

from app.explainability import format_feature_explanation, get_top_contributing_factors
from app.train_model import WelfareRiskModel


class TestExplainability(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data_dir = Path(__file__).resolve().parent.parent.parent / "data" / "synthetic"
        cls.dataset_path = cls.data_dir / "training_dataset.parquet"
        cls.df = pd.read_parquet(cls.dataset_path)

        cls.model_path = Path(__file__).resolve().parent.parent / "model.joblib"
        cls.model = WelfareRiskModel.load(cls.model_path)

    def test_top_3_explanations_count_and_types(self):
        """Validates that calling explanation function returns a list of 3 non-empty strings."""
        sample_row = self.df.iloc[0]
        factors = get_top_contributing_factors(sample_row, top_k=3)

        self.assertIsInstance(factors, list)
        self.assertEqual(len(factors), 3)
        for factor in factors:
            self.assertIsInstance(factor, str)
            self.assertGreater(len(factor), 5)

    def test_high_risk_deployed_person_explanations(self):
        """
        Validates that SN-100043 (critical risk, deployed in hardship level 4 zone for 40 days)
        returns deployment and hardship as top contributing factors.
        """
        p43_matches = self.df[(self.df["service_number"] == "SN-100043") & (self.df["as_of_date"] == "2026-04-27")]
        self.assertFalse(p43_matches.empty, "SN-100043 on 2026-04-27 not found in dataset")
        p43 = p43_matches.iloc[0]

        factors = get_top_contributing_factors(p43, top_k=3)
        combined_text = " ".join(factors).lower()

        print("\n[SN-100043 Explanations]:")
        for f in factors:
            print("  -", f)

        # Asserts deployment / hardship are identified in top factors
        self.assertTrue(
            "deployment" in combined_text or "hardship" in combined_text,
            "Deployment hardship was not surfaced as a top contributing factor for SN-100043",
        )

    def test_high_risk_sudden_drop_person_explanations(self):
        """
        Validates that SN-100034 (high risk with sudden drop and night shifts)
        surfaces sudden drop / night shifts in plain language.
        """
        p34_matches = self.df[(self.df["service_number"] == "SN-100034") & (self.df["as_of_date"] == "2026-01-21")]
        self.assertFalse(p34_matches.empty, "SN-100034 on 2026-01-21 not found in dataset")
        p34 = p34_matches.iloc[0]

        factors = get_top_contributing_factors(p34, top_k=3)
        combined_text = " ".join(factors).lower()

        print("\n[SN-100034 Explanations]:")
        for f in factors:
            print("  -", f)

        self.assertTrue(
            "sudden drop" in combined_text or "night shifts" in combined_text or "help" in combined_text,
            "Sudden drop or night shifts not surfaced for SN-100034",
        )

    def test_model_predict_includes_contributing_factors(self):
        """Validates that WelfareRiskModel returns contributing_factors alongside risk scores."""
        sample_row = self.df.iloc[10]
        prediction = self.model.predict_risk_score(sample_row)

        self.assertIn("contributing_factors", prediction)
        self.assertIsInstance(prediction["contributing_factors"], list)
        self.assertLessEqual(len(prediction["contributing_factors"]), 3)

    def test_format_feature_explanation_format_patterns(self):
        """Validates that plain language string formatters follow Section 5 style."""
        s1 = format_feature_explanation("consecutive_night_shifts", 18.0, 2.0)
        self.assertEqual(s1, "18 consecutive night shifts (population median: 2)")

        s2 = format_feature_explanation("avg_duty_hours_4wk", 12.4, 9.4)
        self.assertIn("12.4 avg daily duty hours", s2)
        self.assertIn("population median: 9.4 hrs", s2)

        s3 = format_feature_explanation("days_since_last_leave", 125.0, 30.0)
        self.assertEqual(s3, "125 days since last leave (population median: 30 days)")


if __name__ == "__main__":
    unittest.main()
