"""
Phase 3.3: Forward-Looking Label Generation.

Generates ground-truth welfare risk labels using each person's FUTURE 30-day
trajectory (t_obs + 1 to t_obs + 30), rather than current/same-day features.

Target Distribution:
- 70% Low Risk
- 22% Moderate Risk
- 7% High Risk
- 1% Critical Risk

Outputs:
- welfare_concern_30d: boolean flag (True for High / Critical, or based on threshold)
- risk_tier: 'low', 'moderate', 'high', 'critical'
- future_mean_stress: mean latent stress in [t+1, t+30]
- future_peak_stress: max latent stress in [t+1, t+30]
- future_stress_integral: cumulative stress exposure
- probability_score: calibrated float in [0.0, 1.0]
- calibrated_score: integer in [0, 100]
"""

from __future__ import annotations

import datetime
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from app.synthetic.trajectory import LatentTrajectory


@dataclass
class LabeledObservation:
    pseudonymous_id: str
    service_number: str
    rank: str
    resilience_trait: float
    observation_date: datetime.date
    observation_day_idx: int

    # Current snapshot features (for inspection/comparison)
    current_day_stress: float
    current_7d_mean_stress: float

    # Future 30-day ground-truth trajectory metrics
    future_mean_stress: float
    future_peak_stress: float
    future_days_above_threshold: int
    future_trajectory_delta: float  # (future_mean - current_7d_mean): trend direction
    future_event_summary: str

    # Ground-truth forward labels
    risk_score_raw: float
    probability_score: float
    calibrated_score: int
    risk_tier: str  # 'low', 'moderate', 'high', 'critical'
    welfare_concern_30d: bool  # True if High or Critical risk


class ForwardLabelGenerator:
    """
    Computes forward-looking ground-truth risk labels across individuals
    and observation timepoints.
    """

    def __init__(
        self,
        horizon_days: int = 30,
        target_split: Tuple[float, float, float, float] = (0.70, 0.22, 0.07, 0.01),
        random_seed: Optional[int] = 42,
    ):
        self.horizon_days = horizon_days
        self.target_split = target_split
        self.rng = np.random.default_rng(random_seed)

    def compute_forward_metrics(
        self,
        traj: LatentTrajectory,
        obs_day: int,
    ) -> Optional[Dict]:
        """
        Computes future 30-day ground truth metrics from day obs_day.
        Requires at least horizon_days in the future.
        """
        if obs_day + self.horizon_days >= traj.num_days:
            return None

        current_stress = float(traj.latent_stress[obs_day])
        start_7d = max(0, obs_day - 6)
        current_7d_mean = float(np.mean(traj.latent_stress[start_7d : obs_day + 1]))

        # Future window: [obs_day + 1, obs_day + horizon_days]
        future_slice = traj.latent_stress[obs_day + 1 : obs_day + self.horizon_days + 1]
        future_mean = float(np.mean(future_slice))
        future_peak = float(np.max(future_slice))
        future_days_above = int(np.sum(future_slice > 5.5))
        delta = future_mean - current_7d_mean

        # Find future events in this 30-day window
        future_events = []
        for ev in traj.events:
            ev_end = ev.end_day if ev.end_day is not None else traj.num_days
            # Check overlap with future window
            if not (ev_end < (obs_day + 1) or ev.start_day > (obs_day + self.horizon_days)):
                future_events.append(f"{ev.event_type}(d{ev.start_day}-d{ev_end})")
        future_event_summary = ", ".join(future_events) or "None"

        # Continuous raw future risk score formulation:
        # Heavily weights future mean, peak acute shock, and prolonged elevated duration
        raw_risk = (
            0.55 * future_mean
            + 0.30 * future_peak
            + 0.15 * (future_days_above / self.horizon_days * 10.0)
        )

        return {
            "pseudonymous_id": str(traj.profile.pseudonymous_id),
            "service_number": traj.profile.service_number,
            "rank": traj.profile.rank,
            "resilience_trait": traj.profile.resilience_trait,
            "observation_date": traj.dates[obs_day],
            "observation_day_idx": obs_day,
            "current_day_stress": current_stress,
            "current_7d_mean_stress": current_7d_mean,
            "future_mean_stress": future_mean,
            "future_peak_stress": future_peak,
            "future_days_above_threshold": future_days_above,
            "future_trajectory_delta": delta,
            "future_event_summary": future_event_summary,
            "raw_risk": raw_risk,
        }

    def generate_population_labels(
        self,
        trajectories: List[LatentTrajectory],
        observation_days: Optional[List[int]] = None,
    ) -> pd.DataFrame:
        """
        Generates labeled dataset for all trajectories across observation points,
        calibrating thresholds to match the 70/22/7/1 distribution.
        """
        if observation_days is None:
            # Default observation points: sample at multiple timepoints across the trajectory
            # e.g., at days 30, 60, 90, 120, 140 (as long as day + 30 < num_days)
            max_day = trajectories[0].num_days - self.horizon_days - 1
            if max_day <= 0:
                raise ValueError("Trajectory duration is too short for 30-day forward horizon.")
            step = max(7, max_day // 6)
            observation_days = list(range(20, max_day + 1, step))

        raw_records = []
        for traj in trajectories:
            for obs_day in observation_days:
                metrics = self.compute_forward_metrics(traj, obs_day)
                if metrics:
                    raw_records.append(metrics)

        df = pd.DataFrame(raw_records)
        if df.empty:
            raise ValueError("No valid forward observation windows found.")

        # Compute empirical quantiles matching target 70 / 22 / 7 / 1 split
        # Quantiles: 70th percentile, 92nd percentile, 99th percentile
        p70 = float(np.percentile(df["raw_risk"], 70.0))
        p92 = float(np.percentile(df["raw_risk"], 92.0))
        p99 = float(np.percentile(df["raw_risk"], 99.0))

        risk_tiers = []
        welfare_concerns = []
        prob_scores = []
        calibrated_scores = []

        min_risk = float(df["raw_risk"].min())
        max_risk = float(df["raw_risk"].max())
        risk_range = max(0.1, max_risk - min_risk)

        for _, row in df.iterrows():
            r = row["raw_risk"]
            # Probability score mapped to [0.0, 1.0] via sigmoid centered near high risk
            prob = 1.0 / (1.0 + np.exp(-1.5 * (r - p92)))
            prob = float(np.clip(prob, 0.001, 0.999))

            if r <= p70:
                tier = "low"
                concern = False
                # Calibrated score 0-49
                score = int(np.clip(round(49 * (r - min_risk) / max(0.01, p70 - min_risk)), 0, 49))
            elif r <= p92:
                tier = "moderate"
                concern = False
                # Calibrated score 50-74
                score = int(np.clip(round(50 + 24 * (r - p70) / max(0.01, p92 - p70)), 50, 74))
            elif r <= p99:
                tier = "high"
                concern = True
                # Calibrated score 75-89
                score = int(np.clip(round(75 + 14 * (r - p92) / max(0.01, p99 - p92)), 75, 89))
            else:
                tier = "critical"
                concern = True
                # Calibrated score 90-100
                score = int(np.clip(round(90 + 10 * (r - p99) / max(0.01, max_risk - p99)), 90, 100))

            risk_tiers.append(tier)
            welfare_concerns.append(concern)
            prob_scores.append(round(prob, 4))
            calibrated_scores.append(score)

        df["risk_tier"] = risk_tiers
        df["welfare_concern_30d"] = welfare_concerns
        df["probability_score"] = prob_scores
        df["calibrated_score"] = calibrated_scores

        return df
