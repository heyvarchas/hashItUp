"""
CLI Runner for Task 3.1: Latent Trajectory Generator.

Usage:
    python -m app.synthetic.generate_trajectories --people 50 --months 6 --plot-out /path/to/plot.png
"""

import argparse
import os
import sys
from pathlib import Path

# Add backend directory to sys.path if running directly
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.synthetic.trajectory import (
    LatentTrajectoryGenerator,
    plot_population_trajectories,
)


def main():
    parser = argparse.ArgumentParser(
        description="Generate synthetic latent stress trajectories for military personnel."
    )
    parser.add_argument(
        "--people",
        type=int,
        default=50,
        help="Number of people/trajectories to generate (default: 50)",
    )
    parser.add_argument(
        "--months",
        type=int,
        default=6,
        help="Simulation duration in months (default: 6, max: 18)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducibility (default: 42)",
    )
    parser.add_argument(
        "--plot-out",
        type=str,
        default="latent_trajectories_50_people.png",
        help="Output filepath for matplotlib trajectory plot (default: latent_trajectories_50_people.png)",
    )

    args = parser.parse_args()

    num_days = args.months * 30  # e.g., 6 * 30 = 180 days (or 18 * 30 = 540 days)

    print(f"============================================================")
    print(f" Task 3.1: Latent-Trajectory Generator Core")
    print(f"============================================================")
    print(f" Generating trajectories for {args.people} individuals...")
    print(f" Simulation Horizon: {args.months} months ({num_days} daily steps)")
    print(f" Random Seed: {args.seed}")

    generator = LatentTrajectoryGenerator(
        num_days=num_days,
        random_seed=args.seed,
    )

    trajectories = generator.generate_population(num_people=args.people)

    print(f"\nSuccessfully simulated {len(trajectories)} distinct person trajectories.\n")
    print(f"{'Index':<6} {'Service No':<12} {'Rank':<6} {'Resilience':<12} {'Base Stress':<12} {'Mean Stress':<12} {'Peak Stress':<12} {'Events'}")
    print("-" * 90)

    for idx, t in enumerate(trajectories[:10]):  # Print first 10 summary
        event_summary = ", ".join([f"{e.event_type}(d{e.start_day})" for e in t.events]) or "None"
        print(
            f"{idx + 1:<6} "
            f"{t.profile.service_number:<12} "
            f"{t.profile.rank:<6} "
            f"{t.profile.resilience_trait:<12.3f} "
            f"{t.profile.baseline_stress:<12.2f} "
            f"{t.mean_stress:<12.2f} "
            f"{t.peak_stress:<12.2f} "
            f"{event_summary}"
        )

    if len(trajectories) > 10:
        print(f"... and {len(trajectories) - 10} more individuals.")

    # Aggregate Statistics
    all_means = [t.mean_stress for t in trajectories]
    all_peaks = [t.peak_stress for t in trajectories]
    all_resilience = [t.profile.resilience_trait for t in trajectories]

    print("\n--- Population Summary Statistics ---")
    print(f" Mean Latent Stress (all people) : {sum(all_means)/len(all_means):.2f} / 10.0")
    print(f" Peak Latent Stress (max observed): {max(all_peaks):.2f} / 10.0")
    print(f" Min Latent Stress (min observed) : {min([min(t.latent_stress) for t in trajectories]):.2f} / 10.0")
    print(f" Resilience Trait Range          : [{min(all_resilience):.3f}, {max(all_resilience):.3f}]")

    # Generate Matplotlib Visualization
    output_path = os.path.abspath(args.plot_out)
    plot_population_trajectories(
        trajectories=trajectories,
        output_path=output_path,
        title=f"Synthetic Latent Stress Trajectories (N={args.people} Personnel, {args.months}-Month Horizon)",
    )

    print(f"\n[Done] Trajectory plot saved to: {output_path}")
    print(f"============================================================\n")


if __name__ == "__main__":
    main()
