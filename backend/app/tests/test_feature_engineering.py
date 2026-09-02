"""
Unit and validation tests for Phase 5.1: Feature Engineering Functions.

Validates that pure-Python / pandas feature engineering functions correctly compute
all Section 4 features (avg_duty_hours_4wk, consecutive_night_shifts,
days_since_last_leave, deployment_duration_days, transfers_last_12mo,
training_load_4wk, wellness_score_trend, sleep_score_trend, sudden_wellness_drop)
against 5 known synthetic people, matching manual spot-checks with zero temporal leakage.
"""

import datetime
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

from app.features import (
    compute_active_deployment_hardship,
    compute_all_features_for_person,
    compute_avg_duty_hours_4wk,
    compute_consecutive_night_shifts,
    compute_days_since_last_leave,
    compute_deployment_duration_days,
    compute_duty_irregularity_index,
    compute_latest_wellness_metrics,
    compute_leave_utilization_rate,
    compute_sleep_score_trend,
    compute_stress_self_rating_trend,
    compute_sudden_wellness_drop,
    compute_total_duty_hours_4wk,
    compute_training_load_4wk,
    compute_transfers_last_12mo,
    compute_wellness_score_trend,
    compute_workload_trend_4wk,
)


class TestFeatureEngineering(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Load synthetic datasets
        data_dir = Path(__file__).resolve().parent.parent.parent / "data" / "synthetic"
        cls.duty_df = pd.read_parquet(data_dir / "duty_records.parquet")
        cls.leave_df = pd.read_parquet(data_dir / "leave_records.parquet")
        cls.deploy_df = pd.read_parquet(data_dir / "deployments.parquet")
        cls.transfers_df = pd.read_parquet(data_dir / "transfers.parquet")
        cls.training_df = pd.read_parquet(data_dir / "training_records.parquet")
        cls.wellness_df = pd.read_parquet(data_dir / "wellness_assessments.parquet")
        cls.personnel_df = pd.read_parquet(data_dir / "personnel.parquet")

        cls.tables = {
            "duty_records": cls.duty_df,
            "leave_records": cls.leave_df,
            "deployments": cls.deploy_df,
            "transfers": cls.transfers_df,
            "training_records": cls.training_df,
            "wellness_assessments": cls.wellness_df,
        }

        # First 5 synthetic personnel
        cls.p1 = cls.personnel_df.iloc[0]  # SN-100001 (WO2)
        cls.p2 = cls.personnel_df.iloc[1]  # SN-100002 (Maj)
        cls.p3 = cls.personnel_df.iloc[2]  # SN-100003 (WO1)
        cls.p4 = cls.personnel_df.iloc[3]  # SN-100004 (Maj)
        cls.p5 = cls.personnel_df.iloc[4]  # SN-100005 (Pte)

    # -------------------------------------------------------------------------
    # Spot Check 1: Manual Calculation Validation for Person 2 (SN-100002)
    # -------------------------------------------------------------------------
    def test_spot_check_person_2_manual_match(self):
        """
        Spot-check calculation for SN-100002 (Maj) as of 2026-03-10:
        - Duty Records: 28 shifts between 2026-02-11 and 2026-03-10, total hours = 269.4
          Mean shift hours = 269.4 / 28 = 9.62
        - Consecutive Night Shifts ending on 2026-03-10 = 0 (worked day/extended)
        - Deployments: Active deployment start_date=2026-02-14, end_date=2026-03-24
          Duration on 2026-03-10 = (2026-03-10 - 2026-02-14) = 24 days
        - Training Records: 4 sessions (5.6 + 3.3 + 3.5 + 6.4) = 18.8 hrs
        - Wellness Submissions: 3 most recent on or before 2026-03-10 are:
          * 2026-03-03: mood=4, sleep=4, stress=4
          * 2026-03-05: mood=3, sleep=4, stress=4
          * 2026-03-08: mood=3, sleep=4, stress=5
          Mood Trend: (3 - 4) / 2 = -0.50
          Sleep Trend: (4 - 4) / 2 = 0.00
          Sudden Mood Drop: (3 - 3) = 0 (No drop >= 2)
        """
        pid = self.p2["pseudonymous_id"]
        as_of = datetime.date(2026, 3, 10)

        feats = compute_all_features_for_person(self.tables, pid, as_of)

        self.assertAlmostEqual(feats["avg_duty_hours_4wk"], 9.62, places=2)
        self.assertEqual(feats["consecutive_night_shifts"], 0)
        self.assertEqual(feats["deployment_duration_days"], 24)
        self.assertAlmostEqual(feats["training_load_4wk"], 18.8, places=1)
        self.assertAlmostEqual(feats["wellness_score_trend"], -0.50, places=2)
        self.assertAlmostEqual(feats["sleep_score_trend"], 0.00, places=2)
        self.assertEqual(feats["sudden_wellness_drop"], 0)

    # -------------------------------------------------------------------------
    # Spot Check 2: Manual Calculation Validation for Person 4 (SN-100004)
    # -------------------------------------------------------------------------
    def test_spot_check_person_4_manual_match(self):
        """
        Spot-check calculation for SN-100004 (Maj) as of 2026-03-10:
        - Duty Records: 23 shifts between 2026-02-11 and 2026-03-10, total hours = 225.7
          Mean shift hours = 225.7 / 23 = 9.81
        - Consecutive Night Shifts: 1 (worked night shift on 2026-03-10, day shift on 2026-03-09)
        - Deployments: None active as of 2026-03-10 -> 0 days
        - Training Records: 9 sessions (4.0+2.9+4.0+1.9+4.9+4.3+5.4+4.3+4.6) = 36.3 hrs
        - Wellness Submissions: 3 most recent on or before 2026-03-10:
          * 2026-03-01: mood=3, sleep=3, stress=3
          * 2026-03-04: mood=4, sleep=3, stress=3
          * 2026-03-09: mood=4, sleep=3, stress=4
          Mood Trend: (4 - 3) / 2 = +0.50
          Sleep Trend: (3 - 3) / 2 = 0.00
          Sudden Mood Drop: 0
        """
        pid = self.p4["pseudonymous_id"]
        as_of = datetime.date(2026, 3, 10)

        feats = compute_all_features_for_person(self.tables, pid, as_of)

        self.assertAlmostEqual(feats["avg_duty_hours_4wk"], 9.81, places=2)
        self.assertEqual(feats["consecutive_night_shifts"], 1)
        self.assertEqual(feats["deployment_duration_days"], 0)
        self.assertAlmostEqual(feats["training_load_4wk"], 36.3, places=1)
        self.assertAlmostEqual(feats["wellness_score_trend"], 0.50, places=2)
        self.assertAlmostEqual(feats["sleep_score_trend"], 0.00, places=2)
        self.assertEqual(feats["sudden_wellness_drop"], 0)

    # -------------------------------------------------------------------------
    # Verification Across All 5 Synthetic Individuals
    # -------------------------------------------------------------------------
    def test_features_computed_for_all_5_people(self):
        as_of = datetime.date(2026, 3, 10)
        for i, person in enumerate([self.p1, self.p2, self.p3, self.p4, self.p5], 1):
            pid = person["pseudonymous_id"]
            feats = compute_all_features_for_person(self.tables, pid, as_of)

            # Core fields present and non-null
            self.assertEqual(feats["pseudonymous_id"], str(pid).lower())
            self.assertGreater(feats["avg_duty_hours_4wk"], 0.0)
            self.assertGreaterEqual(feats["consecutive_night_shifts"], 0)
            self.assertGreaterEqual(feats["days_since_last_leave"], 0.0)
            self.assertGreaterEqual(feats["deployment_duration_days"], 0)
            self.assertGreaterEqual(feats["transfers_last_12mo"], 0)
            self.assertGreaterEqual(feats["training_load_4wk"], 0.0)
            self.assertIn(feats["sudden_wellness_drop"], [0, 1])

    # -------------------------------------------------------------------------
    # Temporal Leakage Strictness Test
    # -------------------------------------------------------------------------
    def test_strict_temporal_no_leakage(self):
        """
        Verify that observations strictly exclude all events occurring after as_of_date.
        """
        pid = self.p2["pseudonymous_id"]
        early_date = datetime.date(2026, 1, 15)  # Day 14
        later_date = datetime.date(2026, 4, 15)  # Day 104

        early_feats = compute_all_features_for_person(self.tables, pid, early_date)
        later_feats = compute_all_features_for_person(self.tables, pid, later_date)

        # Early date (day 14) has only 14 days of history, so total duty hours < 28 days of later date
        self.assertLess(early_feats["total_duty_hours_4wk"], later_feats["total_duty_hours_4wk"])

        # Early date had 0 deployment duration (deployment started in Feb)
        self.assertEqual(early_feats["deployment_duration_days"], 0)

    # -------------------------------------------------------------------------
    # Edge Cases & Boundary Conditions
    # -------------------------------------------------------------------------
    def test_empty_tables_fallback(self):
        empty_tables = {
            "duty_records": pd.DataFrame(),
            "leave_records": pd.DataFrame(),
            "deployments": pd.DataFrame(),
            "transfers": pd.DataFrame(),
            "training_records": pd.DataFrame(),
            "wellness_assessments": pd.DataFrame(),
        }
        feats = compute_all_features_for_person(empty_tables, "dummy-id", datetime.date(2026, 1, 1))

        self.assertEqual(feats["avg_duty_hours_4wk"], 0.0)
        self.assertEqual(feats["consecutive_night_shifts"], 0)
        self.assertEqual(feats["days_since_last_leave"], 365.0)
        self.assertEqual(feats["deployment_duration_days"], 0)
        self.assertEqual(feats["transfers_last_12mo"], 0)
        self.assertEqual(feats["training_load_4wk"], 0.0)
        self.assertEqual(feats["wellness_score_trend"], 0.0)
        self.assertEqual(feats["sleep_score_trend"], 0.0)
        self.assertEqual(feats["sudden_wellness_drop"], 0)

    def test_sudden_wellness_drop_detection(self):
        pid = "test-drop-user"
        as_of = datetime.date(2026, 2, 1)

        # Create mock DataFrame with a sudden drop
        records = [
            {
                "pseudonymous_id": pid,
                "submitted_at": pd.Timestamp("2026-01-20 10:00:00", tz="UTC"),
                "mood_score": 4,
                "sleep_quality_score": 4,
                "stress_self_rating": 3,
                "help_requested": False,
            },
            {
                "pseudonymous_id": pid,
                "submitted_at": pd.Timestamp("2026-01-25 10:00:00", tz="UTC"),
                "mood_score": 4,
                "sleep_quality_score": 3,
                "stress_self_rating": 4,
                "help_requested": False,
            },
            {
                "pseudonymous_id": pid,
                "submitted_at": pd.Timestamp("2026-01-30 10:00:00", tz="UTC"),
                "mood_score": 2,  # Dropped by 2 points (from 4 to 2)
                "sleep_quality_score": 2,
                "stress_self_rating": 8,
                "help_requested": True,
            },
        ]
        df = pd.DataFrame(records)

        drop_flag = compute_sudden_wellness_drop(df, pid, as_of, mood_drop_threshold=2)
        self.assertEqual(drop_flag, 1)

        trend = compute_wellness_score_trend(df, pid, as_of)
        self.assertLess(trend, 0.0)  # Downward slope


if __name__ == "__main__":
    unittest.main()
