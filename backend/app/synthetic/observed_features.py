"""
Phase 3.2: Observed-Feature Generation from Latent Trajectory.

From each person's latent trajectory S_t, generates realistic observed rows for:
1. duty_records: Daily duty shifts ('day', 'night', 'extended') and duty_hours.
2. leave_records: Leave history ('annual', 'sick', 'emergency', 'compassionate').
3. deployments: Operational deployment intervals with hardship levels (1 to 5).
4. transfers: Unit transfer records with timestamps.
5. training_records: Physical/tactical training dates and hours committed.
6. wellness_assessments: Self-assessments with realistic non-daily cadence,
   mood score (1-5), sleep quality (1-5), stress self-rating (1-10), help_requested flag,
   and independent reporting noise.
7. identity schema records: units, personnel, user_roles for relational consistency.

All generated tables match the database schema in models.py and export
cleanly to both CSV and Parquet formats.
"""

from __future__ import annotations

import datetime
import os
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from app.synthetic.trajectory import Event, LatentTrajectory, PersonProfile


class ObservedFeatureGenerator:
    """
    Generates multi-table relational observed data from latent stress trajectories.
    """

    def __init__(self, random_seed: Optional[int] = 42):
        self.rng = np.random.default_rng(random_seed)

    def generate_all_tables(
        self, trajectories: List[LatentTrajectory]
    ) -> Dict[str, pd.DataFrame]:
        """
        Main entrypoint: generates all 6 analytics tables and 3 identity tables.
        """
        # Identity Schema
        units_df = self._generate_units_table(trajectories)
        personnel_df = self._generate_personnel_table(trajectories, units_df)
        roles_df = self._generate_user_roles_table(personnel_df)

        # Analytics Schema
        duty_df = self._generate_duty_records(trajectories)
        leave_df = self._generate_leave_records(trajectories)
        deployments_df = self._generate_deployments(trajectories)
        transfers_df = self._generate_transfers(trajectories)
        training_df = self._generate_training_records(trajectories)
        wellness_df = self._generate_wellness_assessments(trajectories)

        return {
            # Identity tables
            "units": units_df,
            "personnel": personnel_df,
            "user_roles": roles_df,
            # Analytics tables
            "duty_records": duty_df,
            "leave_records": leave_df,
            "deployments": deployments_df,
            "transfers": transfers_df,
            "training_records": training_df,
            "wellness_assessments": wellness_df,
        }

    # -------------------------------------------------------------------------
    # Identity Schema Generators
    # -------------------------------------------------------------------------

    def _generate_units_table(self, trajectories: List[LatentTrajectory]) -> pd.DataFrame:
        unit_names = sorted(list({t.profile.unit_name for t in trajectories}))
        unit_rows = []
        for name in unit_names:
            unit_rows.append({
                "unit_id": str(uuid.uuid4()),
                "unit_name": name,
            })
        return pd.DataFrame(unit_rows)

    def _generate_personnel_table(
        self, trajectories: List[LatentTrajectory], units_df: pd.DataFrame
    ) -> pd.DataFrame:
        unit_map = dict(zip(units_df["unit_name"], units_df["unit_id"]))
        rows = []
        for t in trajectories:
            p = t.profile
            rows.append({
                "person_id": str(p.person_id),
                "service_number": p.service_number,
                "name_enc": None,
                "password_hash": "$argon2id$v=19$m=65536,t=3,p=4$syntheticHashPlaceholder",
                "rank": p.rank,
                "unit_id": unit_map.get(p.unit_name),
                "pseudonymous_id": str(p.pseudonymous_id),
                "active": True,
                "created_at": pd.Timestamp(t.start_date - datetime.timedelta(days=180)),
            })
        return pd.DataFrame(rows)

    def _generate_user_roles_table(self, personnel_df: pd.DataFrame) -> pd.DataFrame:
        rows = []
        for _, person in personnel_df.iterrows():
            # Most are 'personnel', some senior ranks get 'welfare_officer'
            role = "personnel"
            if person["rank"] in ["Capt", "Maj", "WO1"] and self.rng.random() < 0.25:
                role = "welfare_officer"

            rows.append({
                "id": str(uuid.uuid4()),
                "person_id": person["person_id"],
                "role": role,
            })
        return pd.DataFrame(rows)

    # -------------------------------------------------------------------------
    # Analytics Schema Generators
    # -------------------------------------------------------------------------

    def _generate_duty_records(self, trajectories: List[LatentTrajectory]) -> pd.DataFrame:
        """
        Generates daily duty shifts ('day', 'night', 'extended').
        Elevated latent stress increases the probability of extended shifts and
        night rotations with realistic stochasticity.
        """
        rows = []
        for traj in trajectories:
            pid = str(traj.profile.pseudonymous_id)
            leave_days = set()
            for ev in traj.events:
                if ev.event_type == "leave":
                    end = ev.end_day if ev.end_day is not None else ev.start_day + 7
                    for d in range(ev.start_day, min(traj.num_days, end + 1)):
                        leave_days.add(d)

            for t_idx, d_date in enumerate(traj.dates):
                if t_idx in leave_days:
                    continue  # On leave, no duty record

                # Weekend check: ~30% duty probability on weekends unless deployed
                is_weekend = d_date.weekday() >= 5
                is_deployed = any(
                    ev.event_type == "deployment"
                    and ev.start_day <= t_idx <= (ev.end_day or traj.num_days)
                    for ev in traj.events
                )

                if is_weekend and not is_deployed and self.rng.random() > 0.35:
                    continue  # Weekend off

                stress = traj.latent_stress[t_idx]

                # Probabilistic shift selection based on latent stress + noise
                # Base probabilities: Day=0.70, Night=0.20, Extended=0.10
                # Under high stress (e.g. S=8): Day=0.45, Night=0.28, Extended=0.27
                p_extended_raw = 0.08 + 0.025 * (stress - 2.0) + self.rng.normal(0, 0.02)
                p_night_raw = 0.18 + 0.015 * (stress - 2.0) + self.rng.normal(0, 0.02)

                p_ext = float(np.clip(p_extended_raw, 0.05, 0.40))
                p_night = float(np.clip(p_night_raw, 0.10, 0.35))
                p_day = max(0.20, 1.0 - p_ext - p_night)
                probs = np.array([p_day, p_night, p_ext])
                probs /= probs.sum()

                shift_type = self.rng.choice(["day", "night", "extended"], p=probs)

                if shift_type == "day":
                    hours = 8.0 + float(self.rng.choice([0.0, 0.5, 1.0, 1.5], p=[0.6, 0.2, 0.15, 0.05]))
                elif shift_type == "night":
                    hours = 10.0 + float(self.rng.choice([0.0, 0.5, 1.0, 2.0], p=[0.5, 0.25, 0.15, 0.1]))
                else:  # extended
                    hours = 12.0 + 0.3 * stress + float(self.rng.uniform(0.0, 2.5))
                    hours = float(np.clip(hours, 12.0, 18.0))

                rows.append({
                    "id": str(uuid.uuid4()),
                    "pseudonymous_id": pid,
                    "record_date": d_date,
                    "shift_type": shift_type,
                    "duty_hours": round(hours, 1),
                })

        return pd.DataFrame(rows)

    def _generate_leave_records(self, trajectories: List[LatentTrajectory]) -> pd.DataFrame:
        """
        Generates leave records. Includes planned annual leaves as well as
        stress-correlated emergency/sick leaves.
        """
        rows = []
        for traj in trajectories:
            pid = str(traj.profile.pseudonymous_id)

            # Add leaves from simulated trajectory events
            for ev in traj.events:
                if ev.event_type == "leave":
                    start_d = traj.dates[ev.start_day]
                    end_d = traj.dates[min(traj.num_days - 1, ev.end_day or (ev.start_day + 7))]
                    rows.append({
                        "id": str(uuid.uuid4()),
                        "pseudonymous_id": pid,
                        "leave_type": "annual",
                        "start_date": start_d,
                        "end_date": end_d,
                    })

            # High stress periods have higher odds of short sudden emergency / sick leave
            for t_idx, d_date in enumerate(traj.dates):
                stress = traj.latent_stress[t_idx]
                if stress > 6.0 and self.rng.random() < 0.015:
                    dur = int(self.rng.integers(1, 4))
                    start_d = d_date
                    end_d = traj.dates[min(traj.num_days - 1, t_idx + dur)]
                    l_type = self.rng.choice(["sick", "emergency", "compassionate"], p=[0.6, 0.25, 0.15])
                    rows.append({
                        "id": str(uuid.uuid4()),
                        "pseudonymous_id": pid,
                        "leave_type": l_type,
                        "start_date": start_d,
                        "end_date": end_d,
                    })

        return pd.DataFrame(rows)

    def _generate_deployments(self, trajectories: List[LatentTrajectory]) -> pd.DataFrame:
        """
        Extracts deployment periods directly from trajectory events.
        """
        dep_types = ["peacekeeping", "border_patrol", "humanitarian", "tactical_readiness", "special_recon"]
        rows = []
        for traj in trajectories:
            pid = str(traj.profile.pseudonymous_id)
            for ev in traj.events:
                if ev.event_type == "deployment":
                    start_d = traj.dates[ev.start_day]
                    end_d = (
                        traj.dates[min(traj.num_days - 1, ev.end_day)]
                        if ev.end_day is not None and ev.end_day < traj.num_days
                        else None
                    )
                    rows.append({
                        "id": str(uuid.uuid4()),
                        "pseudonymous_id": pid,
                        "deployment_type": str(self.rng.choice(dep_types)),
                        "hardship_level": int(ev.hardship_level),
                        "start_date": start_d,
                        "end_date": end_d,
                    })
        return pd.DataFrame(rows)

    def _generate_transfers(self, trajectories: List[LatentTrajectory]) -> pd.DataFrame:
        """
        Extracts transfer events from trajectories.
        """
        rows = []
        for traj in trajectories:
            pid = str(traj.profile.pseudonymous_id)
            for ev in traj.events:
                if ev.event_type == "transfer":
                    rows.append({
                        "id": str(uuid.uuid4()),
                        "pseudonymous_id": pid,
                        "transfer_date": traj.dates[ev.start_day],
                    })
        return pd.DataFrame(rows)

    def _generate_training_records(self, trajectories: List[LatentTrajectory]) -> pd.DataFrame:
        """
        Generates physical and tactical training logs (e.g. 1-3 times weekly).
        """
        rows = []
        for traj in trajectories:
            pid = str(traj.profile.pseudonymous_id)
            for t_idx, d_date in enumerate(traj.dates):
                # 25% chance of training session on any given weekday
                if d_date.weekday() < 5 and self.rng.random() < 0.25:
                    stress = traj.latent_stress[t_idx]
                    base_hours = 4.0
                    # Intensity increases slightly under operational readiness, with variance
                    hours = base_hours + 0.25 * (stress - 3.0) + self.rng.normal(0, 1.2)
                    hours = float(np.clip(hours, 1.5, 8.0))

                    rows.append({
                        "id": str(uuid.uuid4()),
                        "pseudonymous_id": pid,
                        "training_date": d_date,
                        "hours_committed": round(hours, 1),
                    })
        return pd.DataFrame(rows)

    def _generate_wellness_assessments(
        self, trajectories: List[LatentTrajectory]
    ) -> pd.DataFrame:
        """
        Generates wellness self-assessment submissions.
        Requirements:
        1. Non-daily submission cadence: Submissions occur roughly 1-3 times a week,
           with variable gaps and occasional surges during acute events.
        2. Independent reporting noise per Section 7.2:
           - Mood score (1-5): Inversely related to latent stress + observation noise.
           - Sleep score (1-5): Inversely related to latent stress + shift fatigue noise.
           - Stress self-rating (1-10): Positively related to latent stress + stoicism/reporting bias.
           - Help requested (bool): Rare below stress < 6.0, rises to 20-45% for severe stress (>7.5).
        """
        rows = []
        for traj in trajectories:
            pid = str(traj.profile.pseudonymous_id)
            # Individual reporting bias (e.g. stoic soldier reports stress lower by 1.0 point)
            reporting_bias = float(self.rng.normal(0, 0.4))

            t = 0
            while t < traj.num_days:
                # Submission cadence: Poisson gap of 2 to 5 days
                gap = int(self.rng.integers(2, 6))
                t += gap
                if t >= traj.num_days:
                    break

                d_date = traj.dates[t]
                stress = traj.latent_stress[t]

                # Mood score: 1 (very low) to 5 (excellent)
                # True latent mapping + independent Gaussian noise
                mood_latent = 5.2 - 0.46 * stress + float(self.rng.normal(0, 0.65))
                mood_score = int(np.clip(np.round(mood_latent), 1, 5))

                # Sleep quality score: 1 (very poor) to 5 (excellent)
                sleep_latent = 5.0 - 0.44 * stress + float(self.rng.normal(0, 0.70))
                sleep_score = int(np.clip(np.round(sleep_latent), 1, 5))

                # Stress self-rating: 1 (minimal) to 10 (extreme)
                self_rating_latent = 1.0 + 0.85 * stress + reporting_bias + float(self.rng.normal(0, 0.85))
                stress_self_rating = int(np.clip(np.round(self_rating_latent), 1, 10))

                # Help requested: Logistic sigmoid probability threshold
                help_prob = 1.0 / (1.0 + np.exp(-1.1 * (stress - 7.6)))
                help_requested = bool(self.rng.random() < help_prob)

                # Submission time on that day (e.g. 07:30 to 21:30)
                hour = int(self.rng.integers(7, 22))
                minute = int(self.rng.integers(0, 60))
                submitted_at = pd.Timestamp(
                    datetime.datetime(d_date.year, d_date.month, d_date.day, hour, minute),
                    tz="UTC",
                )

                rows.append({
                    "id": str(uuid.uuid4()),
                    "pseudonymous_id": pid,
                    "submitted_at": submitted_at,
                    "mood_score": mood_score,
                    "sleep_quality_score": sleep_score,
                    "stress_self_rating": stress_self_rating,
                    "help_requested": help_requested,
                    "free_text_note_enc": None,
                })

        return pd.DataFrame(rows)

    def export_to_files(
        self,
        tables: Dict[str, pd.DataFrame],
        output_dir: str,
        formats: Tuple[str, ...] = ("csv", "parquet"),
    ) -> Dict[str, Dict[str, str]]:
        """
        Saves each table into CSV and Parquet files in output_dir.
        Returns a dictionary of generated filepaths.
        """
        os.makedirs(output_dir, exist_ok=True)
        file_paths: Dict[str, Dict[str, str]] = {}

        for table_name, df in tables.items():
            file_paths[table_name] = {}
            if "csv" in formats:
                csv_path = os.path.join(output_dir, f"{table_name}.csv")
                df.to_csv(csv_path, index=False)
                file_paths[table_name]["csv"] = csv_path

            if "parquet" in formats:
                parquet_path = os.path.join(output_dir, f"{table_name}.parquet")
                df.to_parquet(parquet_path, index=False)
                file_paths[table_name]["parquet"] = parquet_path

        return file_paths
