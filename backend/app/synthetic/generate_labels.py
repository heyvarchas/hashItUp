"""
CLI Runner for Task 3.3: Forward-Looking Label Generation & Inspection.

Usage:
    python -m app.synthetic.generate_labels --people 50 --months 6 --out-dir /home/ultron/Desktop/hashItUp/backend/data/synthetic
"""

import argparse
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import pandas as pd

from app.synthetic.labels import ForwardLabelGenerator
from app.synthetic.trajectory import LatentTrajectoryGenerator


def print_distribution_summary(df: pd.DataFrame):
    total = len(df)
    counts = df["risk_tier"].value_counts()
    tiers = ["low", "moderate", "high", "critical"]

    print("=" * 80)
    print(f" RISK TIER DISTRIBUTION SUMMARY (Total Labeled Instances: {total})")
    print("=" * 80)
    print(f"{'Risk Tier':<15} {'Target %':<12} {'Actual Count':<15} {'Actual %':<12} {'Calibrated Score Range'}")
    print("-" * 80)

    target_map = {"low": "70%", "moderate": "22%", "high": "7%", "critical": "1%"}
    for t in tiers:
        cnt = counts.get(t, 0)
        pct = cnt / total * 100
        sub_df = df[df["risk_tier"] == t]
        score_range = f"[{sub_df['calibrated_score'].min()} - {sub_df['calibrated_score'].max()}]" if len(sub_df) else "N/A"
        print(f"{t.capitalize():<15} {target_map[t]:<12} {cnt:<15} {pct:>6.1f}%     {score_range}")

    concern_cnt = sum(df["welfare_concern_30d"])
    print("-" * 80)
    print(f"Total 'welfare_concern_30d' = True (High + Critical): {concern_cnt} ({concern_cnt/total*100:.1f}%)")
    print("=" * 80)


def inspect_five_examples(df: pd.DataFrame) -> list[str]:
    """
    Finds and displays 5 diverse, representative examples demonstrating genuine future trends
    rather than same-day feature copying:
    1. Future Crisis Anticipation: Low/moderate current stress, but High/Critical future label.
    2. Decompression / Recovery: High current stress, but Low/Moderate future label.
    3. Severe Sustained Crisis: Critical risk tier.
    4. Stable High Resilience: Low risk tier throughout.
    5. Unit Transfer Shock in Future Horizon.
    """
    examples = []

    # 1. Future Crisis Anticipation: Current <= 3.8, but Future Mean >= 5.0 and Tier in ('high', 'critical')
    c1 = df[(df["current_7d_mean_stress"] <= 4.0) & (df["future_mean_stress"] >= 4.8) & (df["risk_tier"].isin(["high", "critical"]))]
    ex1 = c1.iloc[0] if not c1.empty else df[df["risk_tier"] == "high"].iloc[0]
    examples.append(("1. Future Escalation / Crisis Ahead", ex1, "Current stress is low/moderate, but upcoming deployment/hardship causes severe future elevation."))

    # 2. Recovery / Decompression: Current >= 4.5, but Future Mean <= 3.5 and Tier in ('low', 'moderate')
    c2 = df[(df["current_7d_mean_stress"] >= 4.5) & (df["future_mean_stress"] <= 3.8) & (df["risk_tier"].isin(["low", "moderate"]))]
    ex2 = c2.iloc[0] if not c2.empty else df[df["future_trajectory_delta"] < -0.8].iloc[0]
    examples.append(("2. Decompression & Recovery", ex2, "Current stress is elevated from past shock, but future 30 days mean-reverts down to safe baseline."))

    # 3. Critical Risk Tier
    c3 = df[df["risk_tier"] == "critical"]
    ex3 = c3.iloc[0] if not c3.empty else df.sort_values(by="raw_risk", ascending=False).iloc[0]
    examples.append(("3. Critical Risk Tier", ex3, "Highest severity tier with multi-factor future strain and prolonged high-stress exposure."))

    # 4. Stable Resilient Individual (Low Risk)
    c4 = df[(df["resilience_trait"] > 0.8) & (df["risk_tier"] == "low")]
    ex4 = c4.iloc[0] if not c4.empty else df[df["risk_tier"] == "low"].iloc[0]
    examples.append(("4. Stable High Resilience", ex4, "Robust baseline resilience maintains low risk across operational windows."))

    # 5. Moderate Risk / Transition
    c5 = df[df["risk_tier"] == "moderate"]
    ex5 = c5.iloc[0] if not c5.empty else df.iloc[10]
    examples.append(("5. Moderate Risk / Intermediate Load", ex5, "Moderate operational friction or minor event creating intermediate risk signature."))

    output_lines = []
    output_lines.append("\n" + "=" * 80)
    output_lines.append(" MANUAL INSPECTION OF 5 LABELED EXAMPLES")
    output_lines.append(" Demonstrating that labels reflect genuine FUTURE trends, not current-week copies.")
    output_lines.append("=" * 80)

    for idx, (title, row, rationale) in enumerate(examples, start=1):
        output_lines.append(f"\n[Example {idx}: {title}]")
        output_lines.append(f"  Service Number        : {row['service_number']} ({row['rank']})")
        output_lines.append(f"  Observation Date      : {row['observation_date']} (Day {row['observation_day_idx']})")
        output_lines.append(f"  Baseline Resilience   : {row['resilience_trait']:.3f}")
        output_lines.append(f"  --- Current Window Snapshot ---")
        output_lines.append(f"  Current Day Stress    : {row['current_day_stress']:.2f} / 10.0")
        output_lines.append(f"  Current 7-Day Mean    : {row['current_7d_mean_stress']:.2f} / 10.0")
        output_lines.append(f"  --- Ground-Truth Future 30-Day Trajectory ---")
        output_lines.append(f"  Future 30-Day Mean    : {row['future_mean_stress']:.2f} / 10.0")
        output_lines.append(f"  Future 30-Day Peak    : {row['future_peak_stress']:.2f} / 10.0")
        output_lines.append(f"  Future Trend Delta    : {row['future_trajectory_delta']:+.2f} ({'RISING' if row['future_trajectory_delta']>0 else 'FALLING'})")
        output_lines.append(f"  Future Events in 30d  : {row['future_event_summary']}")
        output_lines.append(f"  --- Resulting Forward Ground-Truth Label ---")
        output_lines.append(f"  Risk Tier Assigned    : {row['risk_tier'].upper()}")
        output_lines.append(f"  Welfare Concern (30d) : {row['welfare_concern_30d']}")
        output_lines.append(f"  Calibrated Score      : {row['calibrated_score']} / 100 (Probability: {row['probability_score']:.4f})")
        output_lines.append(f"  Key Insight           : {rationale}")
        output_lines.append("-" * 80)

    inspection_text = "\n".join(output_lines)
    print(inspection_text)
    return output_lines


def main():
    parser = argparse.ArgumentParser(
        description="Generate and inspect Phase 3.3 forward-looking ground-truth labels."
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
        help="Directory to export labeled dataset (default: backend/data/synthetic)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed (default: 42)",
    )

    args = parser.parse_args()
    num_days = args.months * 30

    print("=" * 80)
    print(" Phase 3.3: Forward-Looking Ground-Truth Label Generator")
    print("=" * 80)
    print(f" Population : {args.people} individuals")
    print(f" Horizon    : {args.months} months ({num_days} days)")
    print(f" Seed       : {args.seed}\n")

    # 1. Generate Latent Trajectories
    traj_gen = LatentTrajectoryGenerator(num_days=num_days, random_seed=args.seed)
    trajectories = traj_gen.generate_population(num_people=args.people)

    # 2. Generate Forward-Looking Labels across multiple observation windows
    label_gen = ForwardLabelGenerator(horizon_days=30, random_seed=args.seed)
    df_labels = label_gen.generate_population_labels(trajectories)

    # 3. Print Distribution Summary
    print_distribution_summary(df_labels)

    # 4. Inspect 5 Labeled Examples
    inspection_lines = inspect_five_examples(df_labels)

    # 5. Export to CSV and Parquet
    os.makedirs(args.out_dir, exist_ok=True)
    csv_out = os.path.join(args.out_dir, "ground_truth_labels_30d.csv")
    parquet_out = os.path.join(args.out_dir, "ground_truth_labels_30d.parquet")
    report_out = os.path.join(args.out_dir, "phase_3_3_inspection_report.txt")

    df_labels.to_csv(csv_out, index=False)
    df_labels.to_parquet(parquet_out, index=False)

    with open(report_out, "w") as f:
        f.write("\n".join(inspection_lines))

    print(f"\n[Saved] Labeled dataset exported to:")
    print(f"  - CSV    : {csv_out}")
    print(f"  - Parquet: {parquet_out}")
    print(f"  - Report : {report_out}")
    print("\n[Phase 3.3 Completed Successfully]")


if __name__ == "__main__":
    main()
