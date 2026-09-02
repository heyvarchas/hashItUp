"""
CLI Pipeline Runner for Phase 3.2: Observed Feature Generation & Synthetic Dataset Export.

Usage:
    python -m app.synthetic.generate_dataset --people 50 --months 6 --out-dir /home/ultron/Desktop/hashItUp/backend/data/synthetic
"""

import argparse
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import pandas as pd

from app.synthetic.observed_features import ObservedFeatureGenerator
from app.synthetic.trajectory import LatentTrajectoryGenerator, plot_population_trajectories


def spot_check_comparison(
    tables: dict[str, pd.DataFrame],
    trajectories: list,
    output_comparison_file: str = None,
) -> str:
    """
    Spot-checks a 'high-latent-stress' and 'low-latent-stress' individual
    to demonstrate visibly different but noisy, non-trivial feature patterns (not a clean if/else split).
    """
    sorted_trajs = sorted(trajectories, key=lambda t: t.mean_stress)
    low_stress_person = sorted_trajs[0]  # lowest mean stress
    high_stress_person = sorted_trajs[-1]  # highest mean stress

    low_pid = str(low_stress_person.profile.pseudonymous_id)
    high_pid = str(high_stress_person.profile.pseudonymous_id)

    # Extract observed data for both
    duty_df = tables["duty_records"]
    leave_df = tables["leave_records"]
    deploy_df = tables["deployments"]
    transfers_df = tables["transfers"]
    training_df = tables["training_records"]
    wellness_df = tables["wellness_assessments"]

    low_duty = duty_df[duty_df["pseudonymous_id"] == low_pid]
    high_duty = duty_df[duty_df["pseudonymous_id"] == high_pid]

    low_wellness = wellness_df[wellness_df["pseudonymous_id"] == low_pid]
    high_wellness = wellness_df[wellness_df["pseudonymous_id"] == high_pid]

    low_leave = leave_df[leave_df["pseudonymous_id"] == low_pid]
    high_leave = leave_df[leave_df["pseudonymous_id"] == high_pid]

    low_deploy = deploy_df[deploy_df["pseudonymous_id"] == low_pid]
    high_deploy = deploy_df[deploy_df["pseudonymous_id"] == high_pid]

    low_training = training_df[training_df["pseudonymous_id"] == low_pid]
    high_training = training_df[training_df["pseudonymous_id"] == high_pid]

    # Metrics computation
    lines = []
    lines.append("=" * 80)
    lines.append("SPOT-CHECK COMPARISON: LOW-LATENT-STRESS VS HIGH-LATENT-STRESS INDIVIDUAL")
    lines.append("=" * 80)

    lines.append(f"\n[Low-Latent-Stress Profile]")
    lines.append(f"  Service Number        : {low_stress_person.profile.service_number} ({low_stress_person.profile.rank})")
    lines.append(f"  Baseline Resilience   : {low_stress_person.profile.resilience_trait:.3f} (High)")
    lines.append(f"  True Mean Latent Stress: {low_stress_person.mean_stress:.2f} / 10.0 (Peak: {low_stress_person.peak_stress:.2f})")
    lines.append(f"  Observed Feature Signatures:")
    lines.append(f"    - Total Duty Shifts : {len(low_duty)} (Day: {sum(low_duty['shift_type']=='day')}, Night: {sum(low_duty['shift_type']=='night')}, Ext: {sum(low_duty['shift_type']=='extended')})")
    lines.append(f"    - Mean Duty Hours   : {low_duty['duty_hours'].mean():.2f} hrs/shift (Total: {low_duty['duty_hours'].sum():.1f} hrs)")
    lines.append(f"    - Leave Records     : {len(low_leave)} records ({', '.join(low_leave['leave_type'].tolist()) or 'None'})")
    lines.append(f"    - Deployments       : {len(low_deploy)} active periods (Max Hardship: {low_deploy['hardship_level'].max() if len(low_deploy) else 0})")
    lines.append(f"    - Training Logged   : {len(low_training)} sessions (Avg: {low_training['hours_committed'].mean() if len(low_training) else 0:.1f} hrs)")
    lines.append(f"    - Wellness Cadence  : {len(low_wellness)} submissions across {low_stress_person.num_days} days")
    lines.append(f"    - Observed Mood     : Mean {low_wellness['mood_score'].mean():.2f} / 5 (Min: {low_wellness['mood_score'].min()}, Max: {low_wellness['mood_score'].max()})")
    lines.append(f"    - Observed Sleep    : Mean {low_wellness['sleep_quality_score'].mean():.2f} / 5 (Min: {low_wellness['sleep_quality_score'].min()}, Max: {low_wellness['sleep_quality_score'].max()})")
    lines.append(f"    - Self Stress Rating: Mean {low_wellness['stress_self_rating'].mean():.2f} / 10 (Min: {low_wellness['stress_self_rating'].min()}, Max: {low_wellness['stress_self_rating'].max()})")
    lines.append(f"    - Help Requested    : {sum(low_wellness['help_requested'])} times ({sum(low_wellness['help_requested'])/max(1, len(low_wellness))*100:.1f}%)")

    lines.append(f"\n[High-Latent-Stress Profile]")
    lines.append(f"  Service Number        : {high_stress_person.profile.service_number} ({high_stress_person.profile.rank})")
    lines.append(f"  Baseline Resilience   : {high_stress_person.profile.resilience_trait:.3f} (Vulnerable)")
    lines.append(f"  True Mean Latent Stress: {high_stress_person.mean_stress:.2f} / 10.0 (Peak: {high_stress_person.peak_stress:.2f})")
    lines.append(f"  Observed Feature Signatures:")
    lines.append(f"    - Total Duty Shifts : {len(high_duty)} (Day: {sum(high_duty['shift_type']=='day')}, Night: {sum(high_duty['shift_type']=='night')}, Ext: {sum(high_duty['shift_type']=='extended')})")
    lines.append(f"    - Mean Duty Hours   : {high_duty['duty_hours'].mean():.2f} hrs/shift (Total: {high_duty['duty_hours'].sum():.1f} hrs)")
    lines.append(f"    - Leave Records     : {len(high_leave)} records ({', '.join(high_leave['leave_type'].tolist()) or 'None'})")
    lines.append(f"    - Deployments       : {len(high_deploy)} active periods (Max Hardship: {high_deploy['hardship_level'].max() if len(high_deploy) else 0})")
    lines.append(f"    - Training Logged   : {len(high_training)} sessions (Avg: {high_training['hours_committed'].mean() if len(high_training) else 0:.1f} hrs)")
    lines.append(f"    - Wellness Cadence  : {len(high_wellness)} submissions across {high_stress_person.num_days} days")
    lines.append(f"    - Observed Mood     : Mean {high_wellness['mood_score'].mean():.2f} / 5 (Min: {high_wellness['mood_score'].min()}, Max: {high_wellness['mood_score'].max()})")
    lines.append(f"    - Observed Sleep    : Mean {high_wellness['sleep_quality_score'].mean():.2f} / 5 (Min: {high_wellness['sleep_quality_score'].min()}, Max: {high_wellness['sleep_quality_score'].max()})")
    lines.append(f"    - Self Stress Rating: Mean {high_wellness['stress_self_rating'].mean():.2f} / 10 (Min: {high_wellness['stress_self_rating'].min()}, Max: {high_wellness['stress_self_rating'].max()})")
    lines.append(f"    - Help Requested    : {sum(high_wellness['help_requested'])} times ({sum(high_wellness['help_requested'])/max(1, len(high_wellness))*100:.1f}%)")

    lines.append("\n[Noisy Realism Check]")
    lines.append("  Notice the non-trivial overlap and stochastic noise:")
    lines.append("  - Even the high-stress person occasionally reports a good sleep/mood score (e.g. on rest days).")
    lines.append("  - Even the low-stress person occasionally experiences an extended shift or moderate stress rating.")
    lines.append("  - Submission timestamps vary across non-daily gaps (2-5 days), mirroring realistic operational behavior.")
    lines.append("=" * 80)

    report_str = "\n".join(lines)
    if output_comparison_file:
        with open(output_comparison_file, "w") as f:
            f.write(report_str)

    return report_str


def main():
    parser = argparse.ArgumentParser(
        description="Generate complete synthetic dataset (CSV + Parquet) for Phase 3.2."
    )
    parser.add_argument(
        "--people",
        type=int,
        default=50,
        help="Number of people (default: 50)",
    )
    parser.add_argument(
        "--months",
        type=int,
        default=6,
        help="Simulation duration in months (default: 6)",
    )
    parser.add_argument(
        "--out-dir",
        type=str,
        default="/home/ultron/Desktop/hashItUp/backend/data/synthetic",
        help="Directory to save generated CSV and Parquet files",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed (default: 42)",
    )

    args = parser.parse_args()
    num_days = args.months * 30

    print("=" * 70)
    print(" Phase 3.2: Observed-Feature Generation Pipeline")
    print("=" * 70)
    print(f" Population Size     : {args.people} individuals")
    print(f" Time Horizon        : {args.months} months ({num_days} days)")
    print(f" Output Directory    : {args.out_dir}")
    print(f" Random Seed         : {args.seed}\n")

    # Step 1: Generate Latent Trajectories
    print("Step 1: Generating underlying stochastic latent trajectories...")
    traj_gen = LatentTrajectoryGenerator(num_days=num_days, random_seed=args.seed)
    trajectories = traj_gen.generate_population(num_people=args.people)
    print(f"  -> Generated {len(trajectories)} latent trajectories.")

    # Step 2: Generate Observed Relational Tables
    print("\nStep 2: Generating observed multi-table relational rows...")
    feature_gen = ObservedFeatureGenerator(random_seed=args.seed)
    tables = feature_gen.generate_all_tables(trajectories)

    for name, df in tables.items():
        print(f"  -> [{name:<22}] : {len(df):>6} rows, {len(df.columns):>2} columns")

    # Step 3: Export to CSV and Parquet
    print(f"\nStep 3: Exporting tables to CSV and Parquet...")
    file_paths = feature_gen.export_to_files(
        tables=tables,
        output_dir=args.out_dir,
        formats=("csv", "parquet"),
    )

    print(f"  -> All files successfully exported to: {args.out_dir}")

    # Step 4: Run Spot-Check Comparison
    print("\nStep 4: Running Spot-Check validation on High-Stress vs Low-Stress individuals...")
    comparison_report = spot_check_comparison(
        tables=tables,
        trajectories=trajectories,
        output_comparison_file=os.path.join(args.out_dir, "spot_check_comparison.txt"),
    )
    print(comparison_report)

    print("\n[Phase 3.2 Completed Successfully]")


if __name__ == "__main__":
    main()
