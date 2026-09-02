"""
Unit tests for Phase 3.3: Forward-Looking Label Generation.
"""

import unittest
import numpy as np
import pandas as pd

from app.synthetic.labels import ForwardLabelGenerator
from app.synthetic.trajectory import Event, LatentTrajectoryGenerator


class TestForwardLabelGenerator(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.traj_gen = LatentTrajectoryGenerator(num_days=180, random_seed=42)
        cls.trajectories = cls.traj_gen.generate_population(num_people=50)
        cls.label_gen = ForwardLabelGenerator(horizon_days=30, random_seed=42)
        cls.df_labels = cls.label_gen.generate_population_labels(cls.trajectories)

    def test_output_columns_and_bounds(self):
        expected_cols = {
            "pseudonymous_id",
            "service_number",
            "observation_date",
            "current_day_stress",
            "current_7d_mean_stress",
            "future_mean_stress",
            "future_peak_stress",
            "future_days_above_threshold",
            "future_trajectory_delta",
            "raw_risk",
            "probability_score",
            "calibrated_score",
            "risk_tier",
            "welfare_concern_30d",
        }
        self.assertTrue(expected_cols.issubset(set(self.df_labels.columns)))
        self.assertGreater(len(self.df_labels), 0)

        # Check bounds
        self.assertTrue((self.df_labels["calibrated_score"] >= 0).all())
        self.assertTrue((self.df_labels["calibrated_score"] <= 100).all())
        self.assertTrue((self.df_labels["probability_score"] >= 0.0).all())
        self.assertTrue((self.df_labels["probability_score"] <= 1.0).all())
        self.assertTrue(self.df_labels["welfare_concern_30d"].dtype == bool)

    def test_70_22_7_1_split(self):
        total = len(self.df_labels)
        counts = self.df_labels["risk_tier"].value_counts()

        pct_low = counts.get("low", 0) / total
        pct_mod = counts.get("moderate", 0) / total
        pct_high = counts.get("high", 0) / total
        pct_crit = counts.get("critical", 0) / total

        # Verify close alignment with 70% / 22% / 7% / 1%
        self.assertAlmostEqual(pct_low, 0.70, delta=0.04)
        self.assertAlmostEqual(pct_mod, 0.22, delta=0.04)
        self.assertAlmostEqual(pct_high, 0.07, delta=0.03)
        self.assertAlmostEqual(pct_crit, 0.01, delta=0.02)

    def test_forward_looking_trend_distinct_from_current_day(self):
        # Verify that there are cases where current stress is low/normal but future is elevated
        escalating = self.df_labels[
            (self.df_labels["current_7d_mean_stress"] < 3.8)
            & (self.df_labels["future_mean_stress"] > 4.5)
        ]
        self.assertGreater(len(escalating), 0)

        # And cases where current stress is high but future is recovering/de-escalating
        recovering = self.df_labels[
            (self.df_labels["current_7d_mean_stress"] > 4.5)
            & (self.df_labels["future_mean_stress"] < 3.8)
        ]
        self.assertGreater(len(recovering), 0)


if __name__ == "__main__":
    unittest.main()
