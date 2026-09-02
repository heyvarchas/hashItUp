"""
Unit tests for Phase 3.2: Observed-Feature Generation from Latent Trajectory.
"""

import os
import shutil
import tempfile
import unittest
import numpy as np
import pandas as pd

from app.synthetic.observed_features import ObservedFeatureGenerator
from app.synthetic.trajectory import LatentTrajectoryGenerator


class TestObservedFeatureGenerator(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.traj_gen = LatentTrajectoryGenerator(num_days=180, random_seed=42)
        cls.trajectories = cls.traj_gen.generate_population(num_people=20)
        cls.feature_gen = ObservedFeatureGenerator(random_seed=42)
        cls.tables = cls.feature_gen.generate_all_tables(cls.trajectories)

    def test_tables_presence_and_structure(self):
        expected_tables = {
            "units",
            "personnel",
            "user_roles",
            "duty_records",
            "leave_records",
            "deployments",
            "transfers",
            "training_records",
            "wellness_assessments",
        }
        self.assertTrue(expected_tables.issubset(set(self.tables.keys())))

    def test_duty_records_validity(self):
        df = self.tables["duty_records"]
        self.assertGreater(len(df), 0)
        self.assertTrue(set(df["shift_type"].unique()).issubset({"day", "night", "extended"}))
        self.assertTrue((df["duty_hours"] >= 8.0).all())
        self.assertTrue((df["duty_hours"] <= 24.0).all())

    def test_deployments_validity(self):
        df = self.tables["deployments"]
        if len(df) > 0:
            self.assertTrue((df["hardship_level"] >= 1).all())
            self.assertTrue((df["hardship_level"] <= 5).all())

    def test_wellness_assessments_constraints_and_cadence(self):
        df = self.tables["wellness_assessments"]
        self.assertGreater(len(df), 0)

        # Value constraints matching database check constraints
        self.assertTrue((df["mood_score"] >= 1).all() and (df["mood_score"] <= 5).all())
        self.assertTrue((df["sleep_quality_score"] >= 1).all() and (df["sleep_quality_score"] <= 5).all())
        self.assertTrue((df["stress_self_rating"] >= 1).all() and (df["stress_self_rating"] <= 10).all())
        self.assertTrue(df["help_requested"].dtype == bool)

        # Cadence check: non-daily cadence means average submissions per person < 180 (roughly 30-70 submissions)
        submissions_per_person = df.groupby("pseudonymous_id").size()
        mean_subs = submissions_per_person.mean()
        self.assertGreater(mean_subs, 20)
        self.assertLess(mean_subs, 100)  # Non-daily cadence confirmed

    def test_high_vs_low_latent_stress_patterns(self):
        sorted_trajs = sorted(self.trajectories, key=lambda t: t.mean_stress)
        low_person = sorted_trajs[0]
        high_person = sorted_trajs[-1]

        low_pid = str(low_person.profile.pseudonymous_id)
        high_pid = str(high_person.profile.pseudonymous_id)

        w_df = self.tables["wellness_assessments"]
        low_w = w_df[w_df["pseudonymous_id"] == low_pid]
        high_w = w_df[w_df["pseudonymous_id"] == high_pid]

        # Visibly different patterns
        self.assertGreater(low_w["mood_score"].mean(), high_w["mood_score"].mean())
        self.assertGreater(low_w["sleep_quality_score"].mean(), high_w["sleep_quality_score"].mean())
        self.assertLess(low_w["stress_self_rating"].mean(), high_w["stress_self_rating"].mean())

        # Noisy non-trivial overlap (not a clean if/else split: variance > 0)
        self.assertGreater(high_w["mood_score"].std(), 0.1)
        self.assertGreater(low_w["stress_self_rating"].std(), 0.1)

    def test_export_to_csv_and_parquet(self):
        tmp_dir = tempfile.mkdtemp()
        try:
            file_paths = self.feature_gen.export_to_files(
                self.tables, output_dir=tmp_dir, formats=("csv", "parquet")
            )
            for tbl in ["duty_records", "wellness_assessments", "deployments"]:
                self.assertTrue(os.path.exists(file_paths[tbl]["csv"]))
                self.assertTrue(os.path.exists(file_paths[tbl]["parquet"]))

                # Verify files are readable
                read_csv = pd.read_csv(file_paths[tbl]["csv"])
                read_parquet = pd.read_parquet(file_paths[tbl]["parquet"])
                self.assertEqual(len(read_csv), len(self.tables[tbl]))
                self.assertEqual(len(read_parquet), len(self.tables[tbl]))
        finally:
            shutil.rmtree(tmp_dir)


if __name__ == "__main__":
    unittest.main()
