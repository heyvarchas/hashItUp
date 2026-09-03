"""
Phase 6.2: Deterministic Rule Engine Layer.

Implements the deterministic safety & clinical override rules from Section 5
of the MVP plan:
1. `help_requested`: Explicit help requested -> forced escalation to `critical`.
2. `sudden_wellness_drop`: Drop >= 2 points -> forced escalation to at least `high`.
3. `days_since_last_leave`: Prolonged absence of leave (>= 180d -> high, >= 90d -> moderate).
4. `deployment_duration`: Continuous active deployment (>= 180d -> critical, >= 90d -> high, >= 60d -> moderate).

Inviolable Invariant:
Rules can ONLY ESCALATE the risk category, NEVER LOWER IT.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple, Union

# Category severity rankings
CATEGORY_RANK: Dict[str, int] = {
    "low": 0,
    "moderate": 1,
    "high": 2,
    "critical": 3,
}

RANK_TO_CATEGORY: Dict[int, str] = {
    0: "low",
    1: "moderate",
    2: "high",
    3: "critical",
}

CATEGORY_MIN_SCORE: Dict[str, int] = {
    "low": 0,
    "moderate": 35,
    "high": 65,
    "critical": 85,
}


def evaluate_deterministic_rules(
    features: Dict[str, Any],
    raw_category: str,
    raw_score: int,
) -> Dict[str, Any]:
    """
    Evaluates Section 5 deterministic safety and clinical rules against
    an individual's feature vector.

    Can only escalate the risk category; never lowers it.

    Args:
        features: Dictionary of engineered features.
        raw_category: ML model's predicted risk tier ('low' | 'moderate' | 'high' | 'critical').
        raw_score: ML model's raw calibrated integer score (0-100).

    Returns:
        Dictionary containing:
        - raw_category: str
        - raw_score: int
        - final_category: str
        - final_score: int
        - escalated: bool
        - rule_flags: Dict[str, Any]
        - triggered_reasons: List[str]
    """
    current_rank = CATEGORY_RANK.get(raw_category.lower(), 0)
    target_rank = current_rank
    reasons: List[str] = []

    # 1. Rule 1: Explicit Help Requested -> Force Critical (Rank 3)
    help_requested = bool(
        features.get("help_requested_recent", 0) == 1
        or features.get("help_requested", False) is True
    )
    if help_requested:
        target_rank = max(target_rank, CATEGORY_RANK["critical"])
        reasons.append("Personnel explicitly requested welfare assistance (forced escalation to critical).")

    # 2. Rule 2: Sudden Wellness Drop -> Force at least High (Rank 2)
    sudden_drop = bool(features.get("sudden_wellness_drop", 0) == 1)
    if sudden_drop:
        target_rank = max(target_rank, CATEGORY_RANK["high"])
        reasons.append("Sudden drop in self-reported wellness score (>= 2 points, forced escalation to high).")

    # 3. Rule 3: Days Since Last Leave -> Escalation
    days_leave = float(features.get("days_since_last_leave", 0.0))
    total_duty = float(features.get("total_duty_hours_4wk", 0.0))
    avg_duty = float(features.get("avg_duty_hours_4wk", 0.0))

    # If duty features are present and both exactly 0.0, this is a cold-start profile with default 365d
    is_cold_start = ("total_duty_hours_4wk" in features or "avg_duty_hours_4wk" in features) and (total_duty == 0.0 and avg_duty == 0.0)

    leave_triggered = False
    if not is_cold_start:
        if days_leave >= 180:
            target_rank = max(target_rank, CATEGORY_RANK["high"])
            leave_triggered = True
            reasons.append(f"Extended period without leave ({int(days_leave)} days >= 180 days, escalated to high).")
        elif days_leave >= 90:
            target_rank = max(target_rank, CATEGORY_RANK["moderate"])
            leave_triggered = True
            reasons.append(f"Prolonged period without leave ({int(days_leave)} days >= 90 days, escalated to moderate).")

    # 4. Rule 4: Deployment Duration -> Escalation
    deploy_days = float(features.get("deployment_duration_days", 0.0))
    deploy_triggered = False
    if deploy_days >= 180:
        target_rank = max(target_rank, CATEGORY_RANK["critical"])
        deploy_triggered = True
        reasons.append(f"Extended operational deployment ({int(deploy_days)} days >= 180 days, escalated to critical).")
    elif deploy_days >= 90:
        target_rank = max(target_rank, CATEGORY_RANK["high"])
        deploy_triggered = True
        reasons.append(f"Long continuous deployment ({int(deploy_days)} days >= 90 days, escalated to high).")
    elif deploy_days >= 60:
        target_rank = max(target_rank, CATEGORY_RANK["moderate"])
        deploy_triggered = True
        reasons.append(f"Continuous deployment ({int(deploy_days)} days >= 60 days, escalated to moderate).")

    # Final category is strictly >= current_rank (never lowered)
    final_category = RANK_TO_CATEGORY[target_rank]
    is_escalated = target_rank > current_rank

    # Score adjusted to at least the minimum for the escalated tier
    if is_escalated:
        final_score = max(raw_score, CATEGORY_MIN_SCORE[final_category])
    else:
        final_score = raw_score

    rule_flags: Dict[str, Any] = {
        "help_requested": help_requested,
        "sudden_wellness_drop": sudden_drop,
        "days_since_last_leave": leave_triggered,
        "deployment_duration": deploy_triggered,
        "escalated": is_escalated,
        "raw_category": raw_category,
        "final_category": final_category,
        "reasons": reasons,
    }

    return {
        "raw_category": raw_category,
        "raw_score": raw_score,
        "final_category": final_category,
        "final_score": final_score,
        "escalated": is_escalated,
        "rule_flags": rule_flags,
        "triggered_reasons": reasons,
    }
