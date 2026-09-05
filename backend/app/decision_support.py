from typing import Any, Dict, List, Optional, Tuple


def generate_change_request_recommendation(
    request_type: str,
    request_details: Dict[str, Any],
    risk_score: int,
    stress_score: int,
    contributing_factors: List[Dict[str, Any]],
) -> Tuple[str, str]:
    """
    Evaluates decision-support recommendation for employee change requests.
    The officer always remains the final authority; the system provides transparent decision support.

    Safety/Semantic Rule:
    Never claim "Night shifts caused the employee's stress."
    Instead say "Night-shift exposure contributed significantly to the model's elevated welfare-risk prediction."
    """
    req_type = request_type.lower().strip()
    factor_names = [f.get("raw_feature", "").lower() for f in contributing_factors] + \
                   [f.get("display_name", "").lower() for f in contributing_factors]
    factor_text = " ".join(factor_names)

    # Check if key dimensions are elevated
    is_high_risk = risk_score >= 60
    is_elevated_stress = stress_score >= 6

    has_leave_gap = any(k in factor_text for k in ["leave gap", "days_since_last_leave", "leave_deviation", "leave"])
    has_workload = any(k in factor_text for k in ["duty", "workload", "consecutive_work_days", "hours"])
    has_night_shifts = any(k in factor_text for k in ["night", "consecutive_night_shifts", "night_shift"])
    has_hardship_or_transfer = any(k in factor_text for k in ["hardship", "deployment", "transfer"])
    has_sleep_fatigue = any(k in factor_text for k in ["sleep", "fatigue", "mood"])

    if req_type == "leave":
        # Leave Request logic
        if (is_high_risk or is_elevated_stress) and (has_leave_gap or has_sleep_fatigue):
            return (
                "CONSIDER APPROVING",
                "The personnel currently has elevated welfare risk, with prolonged leave gap, elevated fatigue and declining sleep contributing to the prediction."
            )
        elif is_high_risk or is_elevated_stress:
            return (
                "CONSIDER APPROVING",
                "Insufficient recent rest windows and elevated stress indicators contribute to the personnel's elevated welfare-risk prediction."
            )
        else:
            return (
                "CONSIDER APPROVING",
                "Routine operational leave request within manageable baseline welfare parameters."
            )

    elif req_type in ("work_hours", "change_work_hours", "work hours"):
        # Work hours: reduce vs increase
        current_hrs = float(request_details.get("current_hours", 10))
        requested_hrs = float(request_details.get("requested_hours", 8))
        is_reduction = requested_hrs < current_hrs

        if is_reduction:
            if has_workload or is_elevated_stress or is_high_risk:
                return (
                    "CONSIDER APPROVING",
                    "Elevated duty hours and workload deviation are among the largest contributors to the current welfare-risk prediction."
                )
            else:
                return (
                    "CONSIDER APPROVING",
                    "Schedule adjustment within unit tolerance; workload hours are at manageable operational levels."
                )
        else:
            # Increase work hours
            if is_high_risk or is_elevated_stress or has_workload or has_sleep_fatigue:
                return (
                    "REVIEW CAREFULLY",
                    "Current workload, stress, and fatigue indicators are already contributing significantly to elevated welfare risk."
                )
            else:
                return (
                    "CONSIDER APPROVING",
                    "Personnel currently exhibits stable readiness metrics to accommodate temporary workload augmentation."
                )

    elif req_type == "transfer":
        # Transfer Request
        if has_hardship_or_transfer or is_high_risk or is_elevated_stress:
            return (
                "CONSIDER REVIEWING",
                "Deployment hardship and elevated welfare-risk indicators are currently contributing to the personnel's risk profile."
            )
        else:
            return (
                "CONSIDER REVIEWING",
                "Evaluate operational posting vacancy; current welfare indicators are within stable baseline parameters."
            )

    elif req_type in ("night_to_day", "night to day"):
        # Night -> Day Shift change
        if has_night_shifts or has_sleep_fatigue or is_high_risk or is_elevated_stress:
            return (
                "CONSIDER APPROVING",
                "Frequent night shifts and reduced sleep are contributing to elevated welfare risk."
            )
        else:
            return (
                "CONSIDER APPROVING",
                "Transitioning to day schedule supports normalized circadian recovery and circadian fatigue mitigation."
            )

    elif req_type in ("day_to_night", "day to night"):
        # Day -> Night Shift change
        if has_night_shifts or has_sleep_fatigue or is_high_risk or is_elevated_stress:
            return (
                "REVIEW CAREFULLY",
                "Sleep and night-shift indicators are already contributing to elevated welfare risk."
            )
        else:
            return (
                "CONSIDER APPROVING",
                "Personnel currently demonstrates stable sleep and fatigue margins for night duty assignment."
            )

    elif req_type in ("shift_change", "shift change"):
        # Legacy/generic shift change support
        requested_shift = str(request_details.get("requested_shift", "")).lower()
        if "night" in requested_shift:
            if has_night_shifts or is_high_risk or has_sleep_fatigue:
                return (
                    "REVIEW CAREFULLY",
                    "Sleep and night-shift indicators are already contributing to elevated welfare risk."
                )
            else:
                return (
                    "CONSIDER APPROVING",
                    "Monitor sleep patterns if transitioning to nocturnal shift roster."
                )
        else:
            if has_night_shifts or has_sleep_fatigue or is_elevated_stress or is_high_risk:
                return (
                    "CONSIDER APPROVING",
                    "Frequent night shifts and reduced sleep are contributing to elevated welfare risk."
                )
            else:
                return (
                    "CONSIDER APPROVING",
                    "Transitioning to day schedule supports normalized circadian recovery and reduced fatigue."
                )

    # Generic fallback
    if is_high_risk:
        return (
            "CONSIDER APPROVING",
            "Current indicators suggest increased welfare concern; supportive schedule accommodation is advisable."
        )
    return (
        "CONSIDER APPROVING",
        "Operational parameters within acceptable bounds for Welfare Officer discretion."
    )
