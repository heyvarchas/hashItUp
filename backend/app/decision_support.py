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
                "RECOMMEND APPROVAL",
                "Leave gap and recovery duration are significant contributors to the employee's elevated welfare-risk prediction."
            )
        elif is_high_risk or is_elevated_stress:
            return (
                "RECOMMEND APPROVAL",
                "Insufficient recent leave and elevated stress are contributing factors to the employee's elevated welfare-risk prediction."
            )
        else:
            return (
                "CONSIDER APPROVAL",
                "Routine operational leave request within acceptable welfare thresholds."
            )

    elif req_type in ("increase_workers", "increase workers"):
        # Increase Workers
        if has_workload or is_elevated_stress or is_high_risk:
            return (
                "RECOMMEND APPROVAL",
                "Elevated workload and duty-hour deviation are major contributors to the employee's current welfare-risk prediction."
            )
        else:
            return (
                "CONSIDER APPROVAL",
                "Staff augmentation can help sustain baseline duty pacing and prevent future workload strain."
            )

    elif req_type in ("decrease_workers", "decrease workers"):
        # Decrease Workers
        if is_high_risk or is_elevated_stress or has_workload:
            return (
                "REVIEW CAREFULLY",
                "Current workload is already elevated and reducing staffing may increase welfare-risk prediction for this unit."
            )
        else:
            return (
                "REVIEW CAREFULLY",
                "Ensure operational coverage remains sufficient before reducing unit personnel allocation."
            )

    elif req_type == "transfer":
        # Transfer Request
        if has_hardship_or_transfer or is_high_risk:
            return (
                "CONSIDER APPROVAL",
                "Deployment hardship and transfer-related indicators are contributing significantly to the employee's elevated welfare-risk prediction."
            )
        else:
            return (
                "CONSIDER APPROVAL",
                "Evaluate administrative vacancy in preferred unit; current welfare risk is within manageable parameters."
            )

    elif req_type in ("shift_change", "shift change"):
        # Shift change logic
        requested_shift = str(request_details.get("requested_shift", "")).lower()
        if "night" in requested_shift:
            # Transitioning Day -> Night
            if has_night_shifts or is_high_risk or has_sleep_fatigue:
                return (
                    "CONSIDER REJECTING",
                    "Night-shift exposure is already contributing significantly to the model's elevated welfare-risk prediction."
                )
            else:
                return (
                    "CONSIDER CAREFULLY",
                    "Monitor sleep patterns if transitioning to nocturnal shift roster."
                )
        else:
            # Transitioning Night -> Day
            if has_night_shifts or has_sleep_fatigue or is_elevated_stress or is_high_risk:
                return (
                    "RECOMMEND APPROVAL",
                    "Night-shift exposure and sleep deviation are significant contributors to the employee's current welfare-risk prediction."
                )
            else:
                return (
                    "RECOMMEND APPROVAL",
                    "Transitioning to day schedule supports normalized circadian recovery and reduced fatigue."
                )

    # Generic fallback
    if is_high_risk:
        return (
            "CONSIDER APPROVAL",
            "Employee presents elevated welfare-risk indicators; supportive schedule accommodation is advisable."
        )
    return (
        "CONSIDER APPROVAL",
        "Operational parameters within acceptable bounds for commander/officer discretion."
    )
