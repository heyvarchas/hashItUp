"""
Phase 5.4: Feature-Importance & Plain-Language Explanation Engine.

Implements the "top 3 features most deviated from population median, in plain language"
function described in Section 5 of the MVP plan.

Given an individual's engineered feature vector, computes the standardized
risk-direction deviation from the population baseline and translates the top
contributing features into actionable, human-readable plain-language explanations.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd


# Default feature directions: +1 if higher value increases risk, -1 if lower value increases risk
FEATURE_RISK_DIRECTIONS: Dict[str, int] = {
    # Core Section 4 features
    "avg_duty_hours_4wk": +1,
    "consecutive_night_shifts": +1,
    "days_since_last_leave": +1,
    "deployment_duration_days": +1,
    "transfers_last_12mo": +1,
    "training_load_4wk": +1,
    "wellness_score_trend": -1,  # Negative slope = deteriorating mood = higher risk
    "sleep_score_trend": -1,     # Negative slope = deteriorating sleep = higher risk
    "sudden_wellness_drop": +1,  # 1 = sudden drop occurred = higher risk
    # Section 9 extended behavioral features
    "total_duty_hours_4wk": +1,
    "duty_irregularity_index": +1,
    "workload_trend_4wk": +1,
    "leave_utilization_rate": -1,  # Zero/very low leave utilization = higher fatigue risk
    "active_deployment_hardship": +1,
    "stress_self_rating_trend": +1,  # Positive slope = escalating stress = higher risk
    "latest_mood_score": -1,       # Lower mood = higher risk
    "latest_sleep_quality": -1,    # Lower sleep quality = higher risk
    "latest_stress_self_rating": +1,  # Higher stress self-rating = higher risk
    "help_requested_recent": +1,
    "self_report_recency_days": +1,
}

# Human-readable plain-language formatters matching Section 5 specifications
def format_feature_explanation(feature_name: str, value: float, median: float) -> str:
    """Formats a single deviated feature into plain language with population median context."""
    if feature_name == "consecutive_night_shifts":
        val_int = int(round(value))
        med_int = int(round(median))
        return f"{val_int} consecutive night shifts (population median: {med_int})"

    elif feature_name == "avg_duty_hours_4wk":
        return f"{value:.1f} avg daily duty hours per shift (population median: {median:.1f} hrs)"

    elif feature_name == "total_duty_hours_4wk":
        return f"{value:.1f} total duty hours in past 4 weeks (population median: {median:.1f} hrs)"

    elif feature_name == "days_since_last_leave":
        val_int = int(round(value))
        med_int = int(round(median))
        return f"{val_int} days since last leave (population median: {med_int} days)"

    elif feature_name == "deployment_duration_days":
        val_int = int(round(value))
        med_int = int(round(median))
        return f"{val_int} days on active deployment (population median: {med_int} days)"

    elif feature_name == "active_deployment_hardship":
        val_int = int(round(value))
        med_int = int(round(median))
        return f"Active deployment in high hardship zone (level {val_int}/5, population median: {med_int})"

    elif feature_name == "transfers_last_12mo":
        val_int = int(round(value))
        med_int = int(round(median))
        return f"{val_int} unit transfers in past 12 months (population median: {med_int})"

    elif feature_name == "training_load_4wk":
        return f"{value:.1f} training hours in past 4 weeks (population median: {median:.1f} hrs)"

    elif feature_name == "wellness_score_trend":
        return f"Declining wellness mood trend of {value:+.2f} pts/check-in (population median: {median:+.2f})"

    elif feature_name == "sleep_score_trend":
        return f"Deteriorating sleep quality trend of {value:+.2f} pts/check-in (population median: {median:+.2f})"

    elif feature_name == "stress_self_rating_trend":
        return f"Escalating stress rating trend of {value:+.2f} pts/check-in (population median: {median:+.2f})"

    elif feature_name == "sudden_wellness_drop":
        return "Sudden drop in self-reported wellness score (>= 2 points)"

    elif feature_name == "latest_mood_score":
        val_int = int(round(value))
        med_int = int(round(median))
        return f"Low self-reported mood score of {val_int}/5 (population median: {med_int}/5)"

    elif feature_name == "latest_sleep_quality":
        val_int = int(round(value))
        med_int = int(round(median))
        return f"Poor sleep quality rating of {val_int}/5 (population median: {med_int}/5)"

    elif feature_name == "latest_stress_self_rating":
        val_int = int(round(value))
        med_int = int(round(median))
        return f"High self-reported stress rating of {val_int}/10 (population median: {med_int}/10)"

    elif feature_name == "help_requested_recent":
        return "Explicit request for welfare assistance submitted in last 30 days"

    elif feature_name == "duty_irregularity_index":
        return f"High schedule irregularity ({value:.1f} hrs std dev, population median: {median:.1f} hrs)"

    elif feature_name == "workload_trend_4wk":
        pct_val = int(round(value * 100))
        pct_med = int(round(median * 100))
        return f"Workload increased by {pct_val:+d}% vs previous month (population median: {pct_med:+d}%)"

    elif feature_name == "leave_utilization_rate":
        pct_val = int(round(value * 100))
        return f"Low annual leave utilization rate of {pct_val}%"

    elif feature_name == "self_report_recency_days":
        val_int = int(round(value))
        med_int = int(round(median))
        return f"{val_int} days since last wellness submission (population median: {med_int} days)"

    else:
        # Generic fallback
        return f"{feature_name} = {value:.2f} (population median: {median:.2f})"


def get_top_contributing_factors(
    features: Union[Dict[str, Any], pd.Series],
    feature_medians: Optional[Dict[str, float]] = None,
    feature_stds: Optional[Dict[str, float]] = None,
    top_k: int = 3,
) -> List[str]:
    """
    Computes the top K features most deviated from population median in the
    risk-increasing direction and formats them in plain language.

    Args:
        features: Dictionary or pandas Series of engineered feature values.
        feature_medians: Population median dictionary. If None, default baseline medians are used.
        feature_stds: Population standard deviation dictionary for scale normalization.
        top_k: Number of top contributing factors to return (default: 3).

    Returns:
        List of human-readable explanation strings (e.g. ['18 consecutive night shifts (population median: 2)', ...])
    """
    if isinstance(features, pd.Series):
        feat_dict = features.to_dict()
    else:
        feat_dict = dict(features)

    # Use default population baseline medians if none supplied
    medians = feature_medians or {
        "avg_duty_hours_4wk": 9.38,
        "consecutive_night_shifts": 0.0,
        "days_since_last_leave": 365.0,
        "deployment_duration_days": 0.0,
        "transfers_last_12mo": 0.0,
        "training_load_4wk": 19.7,
        "wellness_score_trend": 0.0,
        "sleep_score_trend": 0.0,
        "sudden_wellness_drop": 0.0,
        "total_duty_hours_4wk": 207.5,
        "duty_irregularity_index": 1.96,
        "workload_trend_4wk": 0.02,
        "leave_utilization_rate": 0.0,
        "active_deployment_hardship": 0.0,
        "stress_self_rating_trend": 0.0,
        "latest_mood_score": 4.0,
        "latest_sleep_quality": 4.0,
        "latest_stress_self_rating": 4.0,
        "help_requested_recent": 0.0,
        "self_report_recency_days": 1.0,
    }

    stds = feature_stds or {
        "avg_duty_hours_4wk": 0.47,
        "consecutive_night_shifts": 0.54,
        "days_since_last_leave": 146.67,
        "deployment_duration_days": 11.21,
        "transfers_last_12mo": 0.33,
        "training_load_4wk": 8.35,
        "wellness_score_trend": 0.50,
        "sleep_score_trend": 0.54,
        "sudden_wellness_drop": 0.24,
        "total_duty_hours_4wk": 37.95,
        "duty_irregularity_index": 0.49,
        "workload_trend_4wk": 0.31,
        "leave_utilization_rate": 0.15,
        "active_deployment_hardship": 1.04,
        "stress_self_rating_trend": 0.67,
        "latest_mood_score": 0.84,
        "latest_sleep_quality": 0.86,
        "latest_stress_self_rating": 1.27,
        "help_requested_recent": 0.35,
        "self_report_recency_days": 1.15,
    }

    scored_deviations: List[Tuple[float, str, float, float]] = []

    for feat_name, direction in FEATURE_RISK_DIRECTIONS.items():
        if feat_name not in feat_dict:
            continue

        raw_val = feat_dict[feat_name]
        if raw_val is None or (isinstance(raw_val, float) and math.isnan(raw_val)):
            continue

        try:
            val = float(raw_val)
        except (ValueError, TypeError):
            continue

        med = medians.get(feat_name, 0.0)
        std = max(stds.get(feat_name, 1.0), 0.001)

        # Standardized deviation in risk direction:
        # If direction == +1: (val - med) / std (higher is worse)
        # If direction == -1: (med - val) / std (lower is worse)
        risk_deviation = direction * (val - med) / std

        # For binary flags like sudden_wellness_drop or help_requested_recent,
        # boost priority when active (val >= 1)
        if feat_name in ("sudden_wellness_drop", "help_requested_recent") and val >= 1:
            risk_deviation += 3.0

        scored_deviations.append((risk_deviation, abs(val - med) / std, feat_name, val, med))

    # Primary sort by risk_deviation descending, secondary by absolute deviation
    scored_deviations.sort(key=lambda x: (x[0], x[1]), reverse=True)

    # Extract top_k plain-language explanations
    top_factors: List[str] = []
    seen_features = set()

    for _, _, feat_name, val, med in scored_deviations:
        # Avoid duplicate explanations for closely related total vs avg duty hours
        if feat_name == "total_duty_hours_4wk" and "avg_duty_hours_4wk" in seen_features:
            continue
        if feat_name == "active_deployment_hardship" and "deployment_duration_days" in seen_features:
            continue

        explanation = format_feature_explanation(feat_name, val, med)
        top_factors.append(explanation)
        seen_features.add(feat_name)

        if len(top_factors) >= top_k:
            break

    # If still fewer than top_k, fill with baseline workload indicator
    while len(top_factors) < top_k:
        top_factors.append("Workload metrics within standard operational baseline (population median: 9.4 hrs)")

    return top_factors[:top_k]
