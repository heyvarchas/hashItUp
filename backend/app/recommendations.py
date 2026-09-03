"""
Phase 7.1: Recommendation Engine & Rule Evaluation.

Implements the RECOMMENDATION_RULES list from Section 6 of the MVP plan
and the evaluate_recommendations() function that matches an individual's
computed feature set and risk assessment against clinical & operational
recommendation rules, returning matched recommendation types with rationale strings.

Recommendation Types & Rules:
1. `immediate_welfare_check`:
   - Trigger: help_requested == True OR risk_category == 'critical'
   - Rationale: Urgent welfare check required due to critical risk or explicit request for assistance.
2. `mandatory_rest_period`:
   - Trigger: consecutive_night_shifts >= 5 OR avg_duty_hours_4wk >= 14.0 OR total_duty_hours_4wk >= 260.0
   - Rationale: Mandatory rest period recommended due to sustained high duty hours or consecutive night shifts.
3. `leave_scheduling_intervention`:
   - Trigger: days_since_last_leave >= 90
   - Rationale: Leave scheduling intervention recommended due to prolonged absence of leave.
4. `counseling_support_referral`:
   - Trigger: sudden_wellness_drop == 1 OR latest_mood_score <= 2 OR latest_stress_self_rating >= 8 OR stress_self_rating_trend >= 0.5
   - Rationale: Referral to counseling support services recommended due to acute stress or declining wellness indicators.
5. `deployment_rotation_review`:
   - Trigger: deployment_duration_days >= 60 OR (deployment_duration_days >= 30 AND active_deployment_hardship >= 4)
   - Rationale: Operational rotation or deployment review recommended due to prolonged deployment or high hardship environment.
6. `routine_monitoring`:
   - Trigger: Default fallback when no specific high-risk rules trigger (e.g. low/healthy risk profile).
   - Rationale: Routine monitoring and positive wellbeing reinforcement.
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional, Tuple, Union


# ---------------------------------------------------------------------------
# Section 6 Recommendation Rules Definition
# ---------------------------------------------------------------------------

RECOMMENDATION_RULES: List[Dict[str, Any]] = [
    {
        "type": "immediate_welfare_check",
        "name": "Immediate Welfare Check",
        "description": "Urgent in-person or command welfare check initiated immediately.",
        "condition": lambda f, cat, score: bool(
            f.get("help_requested_recent", 0) == 1
            or f.get("help_requested", False) is True
            or cat == "critical"
            or score >= 85
        ),
        "rationale": (
            "Immediate welfare check required due to critical risk status or "
            "explicit request for assistance."
        ),
    },
    {
        "type": "mandatory_rest_period",
        "name": "Mandatory Rest Period",
        "description": "Mandatory rest and fatigue recovery window before next active shift.",
        "condition": lambda f, cat, score: (
            float(f.get("consecutive_night_shifts", 0)) >= 5
            or float(f.get("avg_duty_hours_4wk", 0.0)) >= 14.0
            or float(f.get("total_duty_hours_4wk", 0.0)) >= 260.0
        ),
        "rationale": (
            "Mandatory rest period recommended due to severe fatigue indicators: "
            "sustained shift lengths or prolonged consecutive night duties."
        ),
    },
    {
        "type": "leave_scheduling_intervention",
        "name": "Leave Scheduling Intervention",
        "description": "Administrative intervention to schedule mandatory rest & recuperation leave.",
        "condition": lambda f, cat, score: (
            float(f.get("days_since_last_leave", 0.0)) >= 90.0
            and not (
                # Exclude cold-start baseline profiles where duty metrics are completely absent
                ("total_duty_hours_4wk" in f or "avg_duty_hours_4wk" in f)
                and float(f.get("total_duty_hours_4wk", 0.0)) == 0.0
                and float(f.get("avg_duty_hours_4wk", 0.0)) == 0.0
            )
        ),
        "rationale": (
            "Leave scheduling intervention recommended due to prolonged continuous duty "
            "without scheduled leave (>= 90 days)."
        ),
    },
    {
        "type": "counseling_support_referral",
        "name": "Counseling Support Referral",
        "description": "Confidential referral to mental health and counseling support services.",
        "condition": lambda f, cat, score: (
            bool(f.get("sudden_wellness_drop", 0) == 1)
            or (f.get("latest_mood_score") is not None and float(f.get("latest_mood_score")) <= 2)
            or (f.get("latest_stress_self_rating") is not None and float(f.get("latest_stress_self_rating")) >= 8)
            or (f.get("stress_self_rating_trend") is not None and float(f.get("stress_self_rating_trend")) >= 0.5)
            or (f.get("wellness_score_trend") is not None and float(f.get("wellness_score_trend")) <= -0.5)
        ),
        "rationale": (
            "Counseling and psychological support referral recommended based on self-reported "
            "acute stress, mood decline, or sudden wellness score drop."
        ),
    },
    {
        "type": "deployment_rotation_review",
        "name": "Deployment Rotation Review",
        "description": "Command review for operational rotation or relief from high hardship post.",
        "condition": lambda f, cat, score: (
            float(f.get("deployment_duration_days", 0.0)) >= 60.0
            or (
                float(f.get("deployment_duration_days", 0.0)) >= 30.0
                and float(f.get("active_deployment_hardship", 0.0)) >= 4.0
            )
        ),
        "rationale": (
            "Deployment rotation review recommended due to extended active deployment "
            "duration or elevated hardship environment."
        ),
    },
]


def evaluate_recommendations(
    features: Dict[str, Any],
    risk_category: str,
    risk_score: int,
    max_recommendations: Optional[int] = None,
) -> List[Dict[str, str]]:
    """
    Evaluates Section 6 recommendation rules against an individual's computed
    feature set and risk evaluation.

    Args:
        features: Dictionary of engineered features.
        risk_category: Final risk category ('low' | 'moderate' | 'high' | 'critical').
        risk_score: Final calibrated integer risk score (0-100).
        max_recommendations: Optional cap on returned recommendations.

    Returns:
        List of dictionaries with keys:
        - recommendation_type: str (e.g. 'immediate_welfare_check')
        - name: str (human readable title)
        - rationale: str (reasoning based on matched features)
    """
    cat_lower = str(risk_category).lower()
    matched: List[Dict[str, str]] = []

    for rule in RECOMMENDATION_RULES:
        try:
            if rule["condition"](features, cat_lower, risk_score):
                matched.append(
                    {
                        "recommendation_type": rule["type"],
                        "name": rule["name"],
                        "rationale": rule["rationale"],
                    }
                )
        except Exception:
            # Defensive guard against malformed feature entries
            continue

    # If no high-risk rules matched (e.g. standard low-risk profile), supply routine monitoring
    if not matched:
        matched.append(
            {
                "recommendation_type": "routine_monitoring",
                "name": "Routine Monitoring",
                "rationale": (
                    "Routine monitoring recommended. Current workload and wellness indicators "
                    "remain within healthy baseline limits."
                ),
            }
        )

    if max_recommendations is not None and max_recommendations > 0:
        return matched[:max_recommendations]

    return matched
