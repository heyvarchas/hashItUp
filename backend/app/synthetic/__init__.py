"""
Synthetic data generation module for Welfare Monitoring System.
Phase 3.1: Latent-trajectory generator core.
Phase 3.2: Observed-feature generation from trajectories.
"""

from app.synthetic.observed_features import ObservedFeatureGenerator
from app.synthetic.trajectory import (
    Event,
    LatentTrajectory,
    LatentTrajectoryGenerator,
    PersonProfile,
    plot_population_trajectories,
)

__all__ = [
    "Event",
    "LatentTrajectory",
    "LatentTrajectoryGenerator",
    "ObservedFeatureGenerator",
    "PersonProfile",
    "plot_population_trajectories",
]
