"""
Unit and validation tests for Phase 5.3: Model Training & Calibration.

Verifies:
1. `model.joblib` artifact exists and loads correctly.
2. Pipeline includes calibrated XGBoost model, baseline LR, feature metadata, and evaluation metrics.
3. XGBoost model beats Logistic Regression baseline on PR-AUC on the test split.
4. Predicts valid calibrated probabilities, calibrated risk scores (0-100), and categorical risk tiers.
"""

import datetime
import unittest
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from app.train_model import FEATURE_COLUMNS, WelfareRiskModel, train_and_calibrate


class TestModelTrainingAndCalibration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data_dir = Path(__file__).resolve().parent.parent.parent / "data" / "synthetic"
        cls.dataset_path = cls.data_dir / "training_dataset.parquet"
        cls.df = pd.read_parquet(cls.dataset_path)

        cls.model_path = Path(__file__).resolve().parent.parent / "model.joblib"
        cls.model_wrapper = WelfareRiskModel.load(cls.model_path)

    def test_model_joblib_file_exists_and_loads(self):
        """Validates that model.joblib artifact exists and has valid contents."""
        self.assertTrue(self.model_path.exists(), "model.joblib does not exist")
        self.assertGreater(self.model_path.stat().st_size, 1000, "model.joblib is unexpectedly small")

        raw_pkg = joblib.load(self.model_path)
        self.assertIn("calibrated_model", raw_pkg)
        self.assertIn("raw_model", raw_pkg)
        self.assertIn("lr_baseline", raw_pkg)
        self.assertIn("feature_names", raw_pkg)
        self.assertIn("feature_medians", raw_pkg)
        self.assertIn("metrics", raw_pkg)

    def test_feature_names_completeness(self):
        """Ensures all Section 4 feature names are present in the trained model."""
        model_feats = self.model_wrapper.feature_names
        section_4_feats = [
            "avg_duty_hours_4wk",
            "consecutive_night_shifts",
            "days_since_last_leave",
            "deployment_duration_days",
            "transfers_last_12mo",
            "training_load_4wk",
            "wellness_score_trend",
            "sleep_score_trend",
            "sudden_wellness_drop",
        ]
        for f in section_4_feats:
            self.assertIn(f, model_feats, f"Missing Section 4 feature in model: {f}")

    def test_xgboost_beats_lr_baseline_on_pr_auc(self):
        """
        Validates the core acceptance criterion:
        XGBoost model beats the Logistic Regression baseline on PR-AUC on the test split.
        """
        metrics = self.model_wrapper.metrics
        self.assertIn("xgb", metrics)
        self.assertIn("lr", metrics)

        xgb_pr_auc = metrics["xgb"]["pr_auc"]
        lr_pr_auc = metrics["lr"]["pr_auc"]

        print(f"\n[Test Verification] XGBoost PR-AUC: {xgb_pr_auc:.4f} vs LR PR-AUC: {lr_pr_auc:.4f}")
        self.assertGreater(
            xgb_pr_auc,
            lr_pr_auc,
            f"XGBoost PR-AUC ({xgb_pr_auc:.4f}) did not beat LR baseline ({lr_pr_auc:.4f})",
        )

    def test_evaluation_metrics_present_and_bounded(self):
        """Ensures precision, recall, F1, ROC-AUC, and PR-AUC are all computed and bounded in [0, 1]."""
        for model_key in ["xgb", "lr"]:
            m = self.model_wrapper.metrics[model_key]
            for metric_name in ["precision", "recall", "f1", "roc_auc", "pr_auc"]:
                self.assertIn(metric_name, m)
                self.assertGreaterEqual(m[metric_name], 0.0)
                self.assertLessEqual(m[metric_name], 1.0)

    def test_predict_risk_score_structure_and_bounds(self):
        """Validates risk score prediction on test records and raw dictionary inputs."""
        test_df = self.df[self.df["split"] == "test"]
        sample_row = test_df.iloc[0]

        pred = self.model_wrapper.predict_risk_score(sample_row)

        self.assertIn("probability_score", pred)
        self.assertIn("calibrated_score", pred)
        self.assertIn("risk_tier", pred)
        self.assertIn("welfare_concern_30d", pred)

        self.assertGreaterEqual(pred["probability_score"], 0.0)
        self.assertLessEqual(pred["probability_score"], 1.0)

        self.assertGreaterEqual(pred["calibrated_score"], 0)
        self.assertLessEqual(pred["calibrated_score"], 100)

        self.assertIn(pred["risk_tier"], ["low", "moderate", "high", "critical"])
        self.assertIsInstance(pred["welfare_concern_30d"], bool)

    def test_high_strain_profile_elevated_risk(self):
        """
        Validates that an individual with severe stress markers (prolonged night shifts,
        deployment hardship, sharp drop in wellness score) gets higher risk prediction
        than a calm baseline profile.
        """
        calm_person = {
            "avg_duty_hours_4wk": 8.0,
            "consecutive_night_shifts": 0,
            "days_since_last_leave": 20.0,
            "deployment_duration_days": 0,
            "transfers_last_12mo": 0,
            "training_load_4wk": 10.0,
            "wellness_score_trend": 0.50,
            "sleep_score_trend": 0.50,
            "sudden_wellness_drop": 0,
            "total_duty_hours_4wk": 160.0,
            "duty_irregularity_index": 0.5,
            "workload_trend_4wk": -0.05,
            "leave_utilization_rate": 0.50,
            "active_deployment_hardship": 0,
            "stress_self_rating_trend": -0.5,
            "latest_mood_score": 4.0,
            "latest_sleep_quality": 4.0,
            "latest_stress_self_rating": 2.0,
            "help_requested_recent": 0,
            "self_report_recency_days": 2.0,
        }

        stressed_person = {
            "avg_duty_hours_4wk": 14.5,
            "consecutive_night_shifts": 12,
            "days_since_last_leave": 150.0,
            "deployment_duration_days": 90,
            "transfers_last_12mo": 2,
            "training_load_4wk": 45.0,
            "wellness_score_trend": -1.50,
            "sleep_score_trend": -1.50,
            "sudden_wellness_drop": 1,
            "total_duty_hours_4wk": 380.0,
            "duty_irregularity_index": 3.8,
            "workload_trend_4wk": 0.45,
            "leave_utilization_rate": 0.05,
            "active_deployment_hardship": 5,
            "stress_self_rating_trend": 2.0,
            "latest_mood_score": 1.0,
            "latest_sleep_quality": 1.0,
            "latest_stress_self_rating": 9.0,
            "help_requested_recent": 1,
            "self_report_recency_days": 1.0,
        }

        calm_pred = self.model_wrapper.predict_risk_score(calm_person)
        stressed_pred = self.model_wrapper.predict_risk_score(stressed_person)

        self.assertGreater(
            stressed_pred["probability_score"],
            calm_pred["probability_score"],
            "Stressed person should receive strictly higher risk probability than calm person",
        )
        self.assertGreater(
            stressed_pred["calibrated_score"],
            calm_pred["calibrated_score"],
            "Stressed person should receive higher calibrated score",
        )


if __name__ == "__main__":
    unittest.main()
