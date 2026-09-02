"""
Phase 3.1: Latent-Trajectory Generator Core.

This module models individual latent stress trajectories over time:
1. Per-person baseline resilience trait (high resilience = lower baseline stress,
   faster mean-reversion, lower sensitivity to acute shocks).
2. Time horizon: Capable of 18 months (~548 days), default configured for 6 months (~180 days).
3. Continuous latent stress dynamic: Ornstein-Uhlenbeck mean-reverting random walk:
     dS_t = kappa * (theta_t - S_t) * dt + sigma * dW_t + Jumps_t
4. Event-driven jumps:
   - Deployment Start: sharp stress jump scaled by hardship level (1-5),
     sustained elevated environmental stress baseline while deployed,
     and post-deployment decompression recovery.
   - Transfer: acute relocation shock / transition friction jump,
     reverting over a few weeks.
   - Leave period: negative stress impulse / rest recovery benefit.
"""

from __future__ import annotations

import datetime
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import matplotlib.pyplot as plt
import numpy as np


@dataclass
class Event:
    """Represents a discrete life/operational event affecting latent stress."""
    event_id: str
    event_type: str  # 'deployment', 'transfer', 'leave'
    start_day: int
    end_day: Optional[int] = None
    hardship_level: int = 1  # 1 to 5
    description: str = ""
    acute_jump: float = 0.0  # Immediate stress shock on start day
    daily_elevation: float = 0.0  # Ongoing stress drift shift while event is active
    decay_half_life: float = 14.0  # Half life in days for acute shock decay


@dataclass
class PersonProfile:
    """Individual baseline traits and stress response parameters."""
    person_id: uuid.UUID
    pseudonymous_id: uuid.UUID
    service_number: str
    rank: str
    unit_name: str

    # Resilience trait: [0.0, 1.0] where 1.0 is extremely resilient, 0.0 is highly vulnerable
    resilience_trait: float

    # Intrinsic baseline stress theta_0 in [1.0, 5.0] (on a 0-10 scale)
    baseline_stress: float

    # Mean reversion speed kappa: rate at which stress pulls back to baseline [0.03, 0.15]
    reversion_rate: float

    # Daily random-walk noise volatility sigma [0.10, 0.35]
    volatility: float

    # Shock sensitivity multiplier (lower for resilient individuals) [0.4, 1.6]
    event_sensitivity: float


@dataclass
class LatentTrajectory:
    """Complete simulated time series of latent stress for a single individual."""
    profile: PersonProfile
    start_date: datetime.date
    num_days: int
    dates: List[datetime.date]
    latent_stress: np.ndarray  # Shape: (num_days,), scale [0.0, 10.0]
    events: List[Event] = field(default_factory=list)
    daily_event_tags: Dict[int, List[str]] = field(default_factory=dict)

    @property
    def mean_stress(self) -> float:
        return float(np.mean(self.latent_stress))

    @property
    def peak_stress(self) -> float:
        return float(np.max(self.latent_stress))

    @property
    def stress_std(self) -> float:
        return float(np.std(self.latent_stress))


class LatentTrajectoryGenerator:
    """
    Generator for multi-person stochastic latent stress trajectories.
    """

    RANKS = ["Pte", "LCpl", "Cpl", "Sgt", "SSgt", "WO2", "WO1", "Lt", "Capt", "Maj"]
    UNITS = [
        "1st Battalion Infantry",
        "3rd Armoured Division",
        "7th Signal Regiment",
        "Medical Logistics Battalion",
        "Air Defense Artillery",
        "Special Operations Support",
    ]

    def __init__(
        self,
        start_date: Optional[datetime.date] = None,
        num_days: int = 180,  # Default 6 months (180 days), capable of 18 months (548 days)
        random_seed: Optional[int] = 42,
    ):
        self.start_date = start_date or datetime.date(2026, 1, 1)
        self.num_days = num_days
        self.rng = np.random.default_rng(random_seed)

    def generate_person_profile(self, index: int) -> PersonProfile:
        """
        Creates a realistic individual profile with correlated resilience traits.
        """
        # Resilience drawn from Beta distribution (mean ~ 0.52, range 0.05 to 0.95)
        resilience = float(np.clip(self.rng.beta(a=3.5, b=3.2), 0.05, 0.95))

        # Baseline stress inversely correlated with resilience + individual noise
        # High resilience (0.9) -> baseline ~ 1.5 - 2.5
        # Low resilience (0.1) -> baseline ~ 4.0 - 5.5
        raw_baseline = 5.2 - 3.4 * resilience + float(self.rng.normal(0, 0.25))
        baseline_stress = float(np.clip(raw_baseline, 1.0, 6.0))

        # Reversion speed: more resilient people recover faster back to baseline
        reversion_rate = float(np.clip(0.04 + 0.10 * resilience + self.rng.normal(0, 0.01), 0.02, 0.20))

        # Volatility: higher resilience slightly dampens day-to-day fluctuations
        volatility = float(np.clip(0.30 - 0.14 * resilience + self.rng.normal(0, 0.02), 0.10, 0.40))

        # Event sensitivity: high resilience absorbs shocks better
        event_sensitivity = float(np.clip(1.55 - 1.10 * resilience + self.rng.normal(0, 0.05), 0.35, 1.80))

        person_id = uuid.uuid4()
        pseudonymous_id = uuid.uuid4()
        service_number = f"SN-{100000 + index:06d}"
        rank = str(self.rng.choice(self.RANKS))
        unit = str(self.rng.choice(self.UNITS))

        return PersonProfile(
            person_id=person_id,
            pseudonymous_id=pseudonymous_id,
            service_number=service_number,
            rank=rank,
            unit_name=unit,
            resilience_trait=resilience,
            baseline_stress=baseline_stress,
            reversion_rate=reversion_rate,
            volatility=volatility,
            event_sensitivity=event_sensitivity,
        )

    def generate_events(self, profile: PersonProfile) -> List[Event]:
        """
        Generates plausible operational and life events for an individual.
        Events include:
        - Deployments (35% probability): 30 to 90 days, hardship level 1-5
        - Transfers (25% probability): sudden base/unit change
        - Leave periods (50% probability): 7 to 14 days of rest (negative stress shock)
        """
        events: List[Event] = []

        # 1. Deployment (35% chance)
        if self.rng.random() < 0.35 and self.num_days >= 60:
            start_day = int(self.rng.integers(15, max(16, self.num_days - 60)))
            max_dur = min(90, self.num_days - start_day - 5)
            duration = int(self.rng.integers(30, max(31, max_dur + 1)))
            end_day = start_day + duration
            hardship = int(self.rng.integers(1, 6))  # 1 to 5

            # Acute jump on deployment start scaled by hardship & sensitivity
            acute_jump = (0.8 + 0.5 * hardship) * profile.event_sensitivity
            # Daily elevated stress while deployed
            daily_elevation = (0.15 + 0.18 * hardship) * profile.event_sensitivity

            events.append(
                Event(
                    event_id=f"DEP-{uuid.uuid4().hex[:6].upper()}",
                    event_type="deployment",
                    start_day=start_day,
                    end_day=end_day,
                    hardship_level=hardship,
                    description=f"Deployment (Hardship Level {hardship})",
                    acute_jump=acute_jump,
                    daily_elevation=daily_elevation,
                    decay_half_life=10.0,
                )
            )

        # 2. Transfer (25% chance)
        if self.rng.random() < 0.25 and self.num_days >= 40:
            transfer_day = int(self.rng.integers(20, self.num_days - 20))
            # Don't place transfer in the middle of active deployment if any
            dep_overlapping = any(
                e.event_type == "deployment" and e.start_day <= transfer_day <= (e.end_day or self.num_days)
                for e in events
            )
            if not dep_overlapping:
                acute_jump = (1.4 + float(self.rng.uniform(0.2, 0.8))) * profile.event_sensitivity
                events.append(
                    Event(
                        event_id=f"TRF-{uuid.uuid4().hex[:6].upper()}",
                        event_type="transfer",
                        start_day=transfer_day,
                        end_day=transfer_day + 14,
                        hardship_level=int(self.rng.integers(1, 4)),
                        description="Unit Transfer / Relocation",
                        acute_jump=acute_jump,
                        daily_elevation=0.3 * profile.event_sensitivity,
                        decay_half_life=14.0,
                    )
                )

        # 3. Leave / Rest Period (50% chance)
        if self.rng.random() < 0.50 and self.num_days >= 50:
            leave_day = int(self.rng.integers(25, self.num_days - 20))
            # Leave shouldn't conflict with deployment start
            dep_overlapping = any(
                e.event_type == "deployment" and e.start_day <= leave_day <= (e.end_day or self.num_days)
                for e in events
            )
            if not dep_overlapping:
                leave_duration = int(self.rng.integers(7, 15))
                events.append(
                    Event(
                        event_id=f"LVE-{uuid.uuid4().hex[:6].upper()}",
                        event_type="leave",
                        start_day=leave_day,
                        end_day=leave_day + leave_duration,
                        hardship_level=1,
                        description="Rest & Recuperation Leave",
                        acute_jump=-1.2 * (0.8 + 0.4 * profile.resilience_trait),
                        daily_elevation=-0.8,
                        decay_half_life=7.0,
                    )
                )

        return events

    def simulate_trajectory(
        self, profile: PersonProfile, events: Optional[List[Event]] = None
    ) -> LatentTrajectory:
        """
        Simulates the daily latent stress trajectory using an Ornstein-Uhlenbeck
        mean-reverting stochastic process with event-driven jumps and decay.
        """
        if events is None:
            events = self.generate_events(profile)

        dates = [self.start_date + datetime.timedelta(days=i) for i in range(self.num_days)]
        latent_stress = np.zeros(self.num_days, dtype=float)
        daily_event_tags: Dict[int, List[str]] = {i: [] for i in range(self.num_days)}

        # Initial stress starts near person's baseline with minor disturbance
        current_stress = float(
            np.clip(
                profile.baseline_stress + self.rng.normal(0, profile.volatility),
                0.5,
                9.5,
            )
        )
        latent_stress[0] = current_stress

        # Track active acute shock states: list of (remaining_shock, decay_lambda)
        active_acute_shocks: List[Tuple[float, float]] = []

        for t in range(self.num_days):
            # 1. Process event starts and ongoing states
            day_event_elevation = 0.0

            for ev in events:
                if ev.start_day == t:
                    # Acute jump occurs today
                    decay_rate = np.log(2.0) / max(1.0, ev.decay_half_life)
                    active_acute_shocks.append((ev.acute_jump, decay_rate))
                    daily_event_tags[t].append(f"{ev.event_type}_start")

                if ev.end_day is not None and ev.end_day == t:
                    daily_event_tags[t].append(f"{ev.event_type}_end")

                # Check if event is actively ongoing
                is_active = False
                if ev.end_day is not None:
                    is_active = ev.start_day <= t <= ev.end_day
                else:
                    is_active = ev.start_day <= t

                if is_active:
                    day_event_elevation += ev.daily_elevation

            # 2. Decay and sum active acute shocks
            total_acute_impact = 0.0
            next_shocks = []
            for shock_val, decay_rate in active_acute_shocks:
                total_acute_impact += shock_val
                new_val = shock_val * np.exp(-decay_rate)
                if abs(new_val) > 0.02:
                    next_shocks.append((new_val, decay_rate))
            active_acute_shocks = next_shocks

            # 3. Dynamic target baseline for the day (base + ongoing event drift)
            target_baseline = profile.baseline_stress + day_event_elevation + total_acute_impact
            target_baseline = float(np.clip(target_baseline, 0.5, 9.5))

            if t > 0:
                # Ornstein-Uhlenbeck drift: pull towards current target baseline
                reversion_drift = profile.reversion_rate * (target_baseline - current_stress)

                # Random Brownian noise
                brownian_noise = float(self.rng.normal(0, profile.volatility))

                # Update stress state
                current_stress = current_stress + reversion_drift + brownian_noise
                # Bound between 0.2 and 10.0
                current_stress = float(np.clip(current_stress, 0.2, 10.0))
                latent_stress[t] = current_stress

        return LatentTrajectory(
            profile=profile,
            start_date=self.start_date,
            num_days=self.num_days,
            dates=dates,
            latent_stress=latent_stress,
            events=events,
            daily_event_tags=daily_event_tags,
        )

    def generate_population(
        self, num_people: int = 50, start_index: int = 1
    ) -> List[LatentTrajectory]:
        """
        Generates trajectories for N distinct individuals starting from start_index.
        """
        trajectories: List[LatentTrajectory] = []
        for i in range(num_people):
            profile = self.generate_person_profile(start_index + i)
            traj = self.simulate_trajectory(profile)
            trajectories.append(traj)
        return trajectories


def plot_population_trajectories(
    trajectories: List[LatentTrajectory],
    output_path: Optional[str] = None,
    title: str = "Synthetic Latent Stress Trajectories (N=50 Individuals)",
    highlight_count: int = 5,
) -> plt.Figure:
    """
    Creates a publication-quality visualization of the 50 latent stress trajectories,
    highlighting diverse archetypes (high resilience, deployment hardship, transfer shocks).
    """
    fig, (ax_main, ax_dist) = plt.subplots(
        nrows=2,
        ncols=1,
        figsize=(14, 9),
        gridspec_kw={"height_ratios": [3.2, 1.2]},
        dpi=150,
    )
    fig.patch.set_facecolor("#0f172a")  # Dark slate background
    ax_main.set_facecolor("#1e293b")
    ax_dist.set_facecolor("#1e293b")

    days = np.arange(trajectories[0].num_days)
    dates = trajectories[0].dates

    # Sort trajectories by baseline resilience to select varied highlights
    sorted_trajs = sorted(trajectories, key=lambda t: t.profile.resilience_trait)

    # Pick 5 distinct archetypes:
    # 1: Most vulnerable (lowest resilience)
    # 2: Deployment with high hardship
    # 3: Unit transfer recipient
    # 4: Average profile
    # 5: High resilience (top resilience)
    low_res_traj = sorted_trajs[0]
    high_res_traj = sorted_trajs[-1]
    mid_traj = sorted_trajs[len(sorted_trajs) // 2]

    dep_trajs = [t for t in sorted_trajs if any(e.event_type == "deployment" and e.hardship_level >= 3 for e in t.events)]
    dep_traj = dep_trajs[0] if dep_trajs else sorted_trajs[2]

    trf_trajs = [t for t in sorted_trajs if any(e.event_type == "transfer" for e in t.events) and t != dep_traj]
    trf_traj = trf_trajs[0] if trf_trajs else sorted_trajs[3]

    highlight_set = {
        low_res_traj.profile.service_number: ("#f43f5e", "Low Resilience / High Vulnerability"),
        dep_traj.profile.service_number: ("#f59e0b", f"Deployment Shock (Hardship Lvl {max([e.hardship_level for e in dep_traj.events if e.event_type == 'deployment'], default=3)})"),
        trf_traj.profile.service_number: ("#38bdf8", "Unit Transfer Shock & Reversion"),
        mid_traj.profile.service_number: ("#a855f7", "Average Resilience / Standard Duty"),
        high_res_traj.profile.service_number: ("#10b981", "High Resilience / Stable Coping"),
    }

    # Plot background trajectories
    for traj in trajectories:
        if traj.profile.service_number not in highlight_set:
            ax_main.plot(
                days,
                traj.latent_stress,
                color="#64748b",
                alpha=0.22,
                linewidth=0.9,
                zorder=1,
            )

    # Plot highlighted archetypes with prominent lines and event markers
    for traj in [mid_traj, trf_traj, dep_traj, low_res_traj, high_res_traj]:
        color, label = highlight_set[traj.profile.service_number]
        ax_main.plot(
            days,
            traj.latent_stress,
            color=color,
            linewidth=2.2,
            alpha=0.95,
            label=f"{label} ({traj.profile.service_number}, Res={traj.profile.resilience_trait:.2f})",
            zorder=3,
        )

        # Plot event markers
        for ev in traj.events:
            if ev.event_type == "deployment" and traj == dep_traj:
                ax_main.axvspan(
                    ev.start_day,
                    ev.end_day or (ev.start_day + 30),
                    color=color,
                    alpha=0.18,
                    zorder=2,
                    label=f"Deployment window (days {ev.start_day}-{ev.end_day})",
                )
                ax_main.annotate(
                    f"Deployment Start\n(Hardship {ev.hardship_level})",
                    xy=(ev.start_day, traj.latent_stress[ev.start_day]),
                    xytext=(ev.start_day + 5, min(9.5, traj.latent_stress[ev.start_day] + 1.2)),
                    arrowprops=dict(facecolor=color, shrink=0.08, width=1.5, headwidth=6),
                    color="#ffffff",
                    fontsize=8,
                    fontweight="bold",
                    bbox=dict(boxstyle="round,pad=0.3", facecolor="#1e293b", edgecolor=color, alpha=0.9),
                )
            elif ev.event_type == "transfer" and traj == trf_traj:
                ax_main.axvline(
                    ev.start_day,
                    color=color,
                    linestyle="--",
                    linewidth=1.5,
                    alpha=0.8,
                    zorder=2,
                )
                ax_main.annotate(
                    "Transfer Jump",
                    xy=(ev.start_day, traj.latent_stress[ev.start_day]),
                    xytext=(ev.start_day - 20, min(9.5, traj.latent_stress[ev.start_day] + 1.0)),
                    arrowprops=dict(facecolor=color, shrink=0.08, width=1.5, headwidth=6),
                    color="#ffffff",
                    fontsize=8,
                    fontweight="bold",
                    bbox=dict(boxstyle="round,pad=0.3", facecolor="#1e293b", edgecolor=color, alpha=0.9),
                )

    # Threshold risk zones
    ax_main.axhline(7.5, color="#ef4444", linestyle=":", alpha=0.6, linewidth=1.2)
    ax_main.text(days[-1] - 18, 7.65, "High / Critical Risk Zone (>7.5)", color="#ef4444", fontsize=8, fontweight="bold")
    ax_main.axhline(5.0, color="#f59e0b", linestyle=":", alpha=0.6, linewidth=1.2)
    ax_main.text(days[-1] - 18, 5.15, "Moderate Risk Zone (>5.0)", color="#f59e0b", fontsize=8, fontweight="bold")

    # Styling Main Plot
    ax_main.set_title(title, color="#f8fafc", fontsize=14, fontweight="bold", pad=12)
    ax_main.set_ylabel("Latent Stress Score (0 - 10)", color="#e2e8f0", fontsize=11, labelpad=10)
    ax_main.set_ylim(0, 10.5)
    ax_main.set_xlim(0, trajectories[0].num_days - 1)
    ax_main.tick_params(colors="#cbd5e1")
    ax_main.grid(True, linestyle="--", alpha=0.15, color="#94a3b8")

    # Date formatting on X axis
    tick_step = max(1, trajectories[0].num_days // 6)
    tick_indices = list(range(0, trajectories[0].num_days, tick_step))
    if tick_indices[-1] != trajectories[0].num_days - 1:
        tick_indices.append(trajectories[0].num_days - 1)
    ax_main.set_xticks(tick_indices)
    ax_main.set_xticklabels([dates[i].strftime("%b %d") for i in tick_indices], color="#cbd5e1")

    legend = ax_main.legend(
        loc="upper left",
        facecolor="#0f172a",
        edgecolor="#334155",
        labelcolor="#f8fafc",
        fontsize=8.5,
        framealpha=0.9,
    )
    for text in legend.get_texts():
        text.set_color("#f8fafc")

    # Bottom Subplot: Population Resilience vs Mean Latent Stress
    resilience_vals = [t.profile.resilience_trait for t in trajectories]
    mean_stress_vals = [t.mean_stress for t in trajectories]

    scatter = ax_dist.scatter(
        resilience_vals,
        mean_stress_vals,
        c=mean_stress_vals,
        cmap="coolwarm",
        s=45,
        alpha=0.85,
        edgecolors="#ffffff",
        linewidths=0.5,
    )
    ax_dist.set_title(
        "Trait Correlation: Baseline Resilience vs Mean Latent Stress (N=50)",
        color="#f8fafc",
        fontsize=10.5,
        fontweight="bold",
        pad=8,
    )
    ax_dist.set_xlabel("Individual Baseline Resilience Trait (0.0 = Vulnerable, 1.0 = Highly Resilient)", color="#e2e8f0", fontsize=9.5)
    ax_dist.set_ylabel("Mean Latent Stress", color="#e2e8f0", fontsize=9.5)
    ax_dist.tick_params(colors="#cbd5e1")
    ax_dist.grid(True, linestyle="--", alpha=0.15, color="#94a3b8")
    ax_dist.set_xlim(0.0, 1.0)

    plt.tight_layout()

    if output_path:
        plt.savefig(output_path, dpi=180, facecolor=fig.get_facecolor(), bbox_inches="tight")
        print(f"Figure successfully saved to: {output_path}")

    return fig
