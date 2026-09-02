"""
Unit and validation tests for Phase 5.2: Training Dataset Assembly & Temporal Split.

Verifies:
1. Output Parquet file exists, has one row per (person, as_of_date), correct feature columns, and label column.
2. Temporal split strictly partitions train/val/test by time without leakage.
3. Zero rows where as_of_date is after any input data used to compute that row's features.
"""

import datetime
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

from app.synthetic.assemble_dataset import (
    assemble_training_dataset,
    assign_temporal_split,
    load_synthetic_tables,
    verify_no_temporal_leakage,
)


class TestTrainingDatasetAssembly(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data_dir = Path(__file__).resolve().parent.parent.parent / "data" / "synthetic"
        cls.tables, cls.personnel_df, cls.labels_df = load_synthetic_tables(cls.data_dir)
        cls.parquet_path = cls.data_dir / "training_dataset.parquet"
        cls.df = pd.read_parquet(cls.parquet_path)

    def test_parquet_file_exists_and_loads(self):
        """Validates that training_dataset.parquet exists and has valid size."""
        self.assertTrue(self.parquet_path.exists(), "training_dataset.parquet does not exist")
        self.assertGreater(self.parquet_path.stat().st_size, 1000, "File is unexpectedly small")
        self.assertFalse(self.df.empty, "Loaded dataframe is empty")

    def test_correct_row_count_and_uniqueness(self):
        """
        Validates exactly one row per (person, as_of_date) combination.
        50 personnel x 6 observation dates = 300 rows.
        """
        self.assertEqual(len(self.df), 300)
        self.assertEqual(self.df["pseudonymous_id"].nunique(), 50)
        self.assertEqual(self.df["as_of_date"].nunique(), 6)

        # Check uniqueness of (pseudonymous_id, as_of_date)
        duplicates = self.df.duplicated(subset=["pseudonymous_id", "as_of_date"])
        self.assertEqual(duplicates.sum(), 0, f"Found {duplicates.sum()} duplicate (person, date) rows")

    def test_required_feature_columns_present(self):
        """
        Validates presence of all Section 4 features and target label column.
        """
        required_section_4_features = [
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
        required_label_columns = [
            "label",
            "welfare_concern_30d",
            "risk_tier",
            "calibrated_score",
            "probability_score",
        ]
        required_metadata = [
            "pseudonymous_id",
            "as_of_date",
            "split",
        ]

        for col in required_section_4_features:
            self.assertIn(col, self.df.columns, f"Missing Section 4 feature column: {col}")
            # Ensure no nulls or NaNs in feature column
            self.assertEqual(self.df[col].isna().sum(), 0, f"NaNs found in feature column: {col}")

        for col in required_label_columns:
            self.assertIn(col, self.df.columns, f"Missing label column: {col}")

        for col in required_metadata:
            self.assertIn(col, self.df.columns, f"Missing metadata column: {col}")

    def test_temporal_split_strictly_by_time_no_leakage(self):
        """
        Validates temporal train/val/test split:
        Train dates < Val dates < Test dates (strictly partitioned by time).
        """
        self.assertIn("split", self.df.columns)
        splits = set(self.df["split"].unique())
        self.assertEqual(splits, {"train", "val", "test"})

        train_dates = set(self.df[self.df["split"] == "train"]["as_of_date"])
        val_dates = set(self.df[self.df["split"] == "val"]["as_of_date"])
        test_dates = set(self.df[self.df["split"] == "test"]["as_of_date"])

        # Disjoint dates
        self.assertEqual(len(train_dates.intersection(val_dates)), 0)
        self.assertEqual(len(train_dates.intersection(test_dates)), 0)
        self.assertEqual(len(val_dates.intersection(test_dates)), 0)

        # Strict chronological ordering: max(train) < min(val) and max(val) < min(test)
        max_train = max(train_dates)
        min_val = min(val_dates)
        max_val = max(val_dates)
        min_test = min(test_dates)

        self.assertLess(max_train, min_val, "Train dates must strictly precede validation dates")
        self.assertLess(max_val, min_test, "Validation dates must strictly precede test dates")

    def test_zero_future_leakage_audit(self):
        """
        Validates that zero rows have as_of_date after future data used.
        """
        is_valid, violations = verify_no_temporal_leakage(self.tables, self.df)
        self.assertTrue(is_valid)
        self.assertEqual(violations, 0)

    def test_target_label_integrity(self):
        """
        Validates that label column is binary integer {0, 1} matching welfare_concern_30d.
        """
        self.assertTrue(set(self.df["label"].unique()).issubset({0, 1}))
        matching = (self.df["label"] == 1) == self.df["welfare_concern_30d"]
        self.assertTrue(matching.all(), "label column does not match welfare_concern_30d boolean flag")


if __name__ == "__main__":
    unittest.main()
