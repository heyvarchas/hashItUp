"""
Unit tests for Phase 3.1: Latent-Trajectory Generator Core.
"""

import unittest
import numpy as np

from app.synthetic.trajectory import (
    Event,
    LatentTrajectoryGenerator,
    PersonProfile,
    plot_population_trajectories,
)


class TestTrajectoryGenerator(unittest.TestCase):
    def test_profile_generation(self):
        generator = LatentTrajectoryGenerator(random_seed=123)
        profiles = [generator.generate_person_profile(i) for i in range(20)]

        self.assertEqual(len(profiles), 20)
        # Verify uniqueness of IDs and service numbers
        self.assertEqual(len({p.person_id for p in profiles}), 20)
        self.assertEqual(len({p.pseudonymous_id for p in profiles}), 20)
        self.assertEqual(len({p.service_number for p in profiles}), 20)

        # Resilience is bounded in [0.0, 1.0]
        for p in profiles:
            self.assertTrue(0.0 <= p.resilience_trait <= 1.0)
            self.assertTrue(1.0 <= p.baseline_stress <= 6.0)
            self.assertTrue(0.02 <= p.reversion_rate <= 0.25)
            self.assertTrue(0.10 <= p.volatility <= 0.45)

    def test_trajectory_simulation_180_days(self):
        generator = LatentTrajectoryGenerator(num_days=180, random_seed=42)
        trajectories = generator.generate_population(num_people=50)

        self.assertEqual(len(trajectories), 50)
        for traj in trajectories:
            self.assertEqual(traj.num_days, 180)
            self.assertEqual(len(traj.dates), 180)
            self.assertEqual(len(traj.latent_stress), 180)
            # Check all stress values are valid non-NaN finite numbers in [0.2, 10.0]
            self.assertTrue(np.all(np.isfinite(traj.latent_stress)))
            self.assertTrue(np.all(traj.latent_stress >= 0.2))
            self.assertTrue(np.all(traj.latent_stress <= 10.0))

    def test_trajectory_simulation_18_months_capability(self):
        # 18 months = 540 days
        generator = LatentTrajectoryGenerator(num_days=540, random_seed=99)
        profile = generator.generate_person_profile(1)
        traj = generator.simulate_trajectory(profile)

        self.assertEqual(traj.num_days, 540)
        self.assertEqual(len(traj.latent_stress), 540)
        self.assertTrue(np.all(np.isfinite(traj.latent_stress)))

    def test_event_driven_jumps(self):
        generator = LatentTrajectoryGenerator(num_days=100, random_seed=10)
        profile = generator.generate_person_profile(1)

        # Force a specific deployment event at day 30 with hardship 5
        dep_event = Event(
            event_id="DEP-TEST",
            event_type="deployment",
            start_day=30,
            end_day=60,
            hardship_level=5,
            acute_jump=3.0,
            daily_elevation=0.8,
            decay_half_life=7.0,
        )

        traj = generator.simulate_trajectory(profile, events=[dep_event])
        self.assertIn("deployment_start", traj.daily_event_tags[30])
        self.assertIn("deployment_end", traj.daily_event_tags[60])

        # Stress during deployment (day 31-45) should be noticeably higher on average than pre-deployment baseline
        pre_stress = float(np.mean(traj.latent_stress[10:30]))
        dep_stress = float(np.mean(traj.latent_stress[31:45]))
        self.assertGreater(dep_stress, pre_stress)


if __name__ == "__main__":
    unittest.main()
