"""
Phase 5.1: Feature Engineering Functions.

Pure-Python and pandas functions for computing behavioral and operational
features from Section 4 and Section 9 of the MVP plan given a `pseudonymous_id`
and an `as_of_date`.

Key Features from Section 4 of the MVP Plan:
1. avg_duty_hours_4wk: Mean of duty_hours over trailing 28 days.
2. consecutive_night_shifts: Longest current streak of shift_type='night' up to as_of_date.
3. days_since_last_leave: Days elapsed since the most recent completed or active leave.
4. deployment_duration_days: Days on active deployment as of as_of_date (0 if not deployed).
5. transfers_last_12mo: Count of unit transfer events in trailing 365 days.
6. training_load_4wk: Total training hours committed over trailing 28 days.
7. wellness_score_trend: Slope of self-reported mood/wellness score over trailing 3 submissions.
8. sleep_score_trend: Slope of sleep_quality_score over trailing 3 submissions.
9. sudden_wellness_drop: Indicator (0 or 1) if latest self-report dropped >= 2 points vs previous.

Additional Derived Features (Section 9):
- stress_self_rating_trend: Slope of stress_self_rating over trailing 3 submissions.
- latest_mood_score: Most recent mood score on or before as_of_date.
- latest_sleep_score: Most recent sleep quality score on or before as_of_date.
- latest_stress_self_rating: Most recent self-reported stress on or before as_of_date.
- help_requested_recent: Indicator if help requested in trailing 30 days.
- self_report_recency_days: Days since latest wellness assessment submission.
- workload_trend_4wk: Percentage change in duty hours (current 4wk vs prior 4wk).
- duty_irregularity_index: Standard deviation of duty hours over trailing 28 days.
- active_deployment_hardship: Hardship level (1-5) of active deployment (0 if not deployed).
"""

from __future__ import annotations

import datetime
import uuid
from typing import Any, Dict, List, Optional, Union

import numpy as np
import pandas as pd


def _parse_date(date_val: Union[datetime.date, datetime.datetime, str, pd.Timestamp]) -> datetime.date:
    """Standardizes any date/datetime representation into a datetime.date object."""
    if isinstance(date_val, datetime.datetime):
        return date_val.date()
    elif isinstance(date_val, pd.Timestamp):
        return date_val.date()
    elif isinstance(date_val, datetime.date):
        return date_val
    elif isinstance(date_val, str):
        return pd.to_datetime(date_val).date()
    else:
        raise ValueError(f"Unsupported date format: {type(date_val)} ({date_val})")


def _str_id(val: Union[str, uuid.UUID]) -> str:
    """Ensures UUIDs and strings are comparable as lowercase string representations."""
    return str(val).lower()


# =============================================================================
# 1. Duty Records Features (duty_records)
# =============================================================================

def compute_avg_duty_hours_4wk(
    duty_df: pd.DataFrame,
    pseudonymous_id: Union[str, uuid.UUID],
    as_of_date: Union[datetime.date, str],
    window_days: int = 28,
) -> float:
    """
    Computes the mean shift duty hours over the trailing 28-day window:
    [as_of_date - (window_days - 1), as_of_date].

    Returns 0.0 if no duty shifts were worked in the window.
    """
    target_id = _str_id(pseudonymous_id)
    as_of = _parse_date(as_of_date)
    start_date = as_of - datetime.timedelta(days=window_days - 1)

    if duty_df.empty:
        return 0.0

    # Ensure date column is datetime.date
    if not isinstance(duty_df["record_date"].iloc[0], datetime.date):
        duty_dates = pd.to_datetime(duty_df["record_date"]).dt.date
    else:
        duty_dates = duty_df["record_date"]

    mask = (
        (duty_df["pseudonymous_id"].astype(str).str.lower() == target_id)
        & (duty_dates >= start_date)
        & (duty_dates <= as_of)
    )
    subset = duty_df[mask]

    if subset.empty:
        return 0.0

    return float(round(float(subset["duty_hours"].mean()), 2))


def compute_total_duty_hours_4wk(
    duty_df: pd.DataFrame,
    pseudonymous_id: Union[str, uuid.UUID],
    as_of_date: Union[datetime.date, str],
    window_days: int = 28,
) -> float:
    """Computes total duty hours logged over trailing 28 days."""
    target_id = _str_id(pseudonymous_id)
    as_of = _parse_date(as_of_date)
    start_date = as_of - datetime.timedelta(days=window_days - 1)

    if duty_df.empty:
        return 0.0

    if not isinstance(duty_df["record_date"].iloc[0], datetime.date):
        duty_dates = pd.to_datetime(duty_df["record_date"]).dt.date
    else:
        duty_dates = duty_df["record_date"]

    mask = (
        (duty_df["pseudonymous_id"].astype(str).str.lower() == target_id)
        & (duty_dates >= start_date)
        & (duty_dates <= as_of)
    )
    subset = duty_df[mask]

    if subset.empty:
        return 0.0

    return float(round(float(subset["duty_hours"].sum()), 2))


def compute_consecutive_night_shifts(
    duty_df: pd.DataFrame,
    pseudonymous_id: Union[str, uuid.UUID],
    as_of_date: Union[datetime.date, str],
) -> int:
    """
    Computes the current streak of consecutive night shifts immediately
    ending on or trailing up to as_of_date.

    If as_of_date or the immediately preceding active shift day is a night shift,
    counts consecutive calendar days back with shift_type == 'night'.
    """
    target_id = _str_id(pseudonymous_id)
    as_of = _parse_date(as_of_date)

    if duty_df.empty:
        return 0

    if not isinstance(duty_df["record_date"].iloc[0], datetime.date):
        duty_dates = pd.to_datetime(duty_df["record_date"]).dt.date
    else:
        duty_dates = duty_df["record_date"]

    mask = (
        (duty_df["pseudonymous_id"].astype(str).str.lower() == target_id)
        & (duty_dates <= as_of)
    )
    subset = duty_df[mask].copy()
    if subset.empty:
        return 0

    subset["d_date"] = duty_dates[mask]
    records = subset.sort_values("d_date", ascending=False).drop_duplicates(subset=["d_date"])

    night_streak = 0
    curr_date = as_of

    # Check if there is an active streak starting at as_of or as_of - 1 (if as_of was off)
    first_record = records.iloc[0]
    first_date = first_record["d_date"]

    # If most recent duty was more than 1 day before as_of and not a night shift, streak is 0
    if (as_of - first_date).days > 1:
        return 0

    if (as_of - first_date).days == 1:
        curr_date = first_date

    for _, row in records.iterrows():
        rec_date = row["d_date"]
        if rec_date == curr_date:
            if row["shift_type"] == "night":
                night_streak += 1
                curr_date -= datetime.timedelta(days=1)
            else:
                break
        elif rec_date < curr_date:
            break

    return night_streak


def compute_duty_irregularity_index(
    duty_df: pd.DataFrame,
    pseudonymous_id: Union[str, uuid.UUID],
    as_of_date: Union[datetime.date, str],
    window_days: int = 28,
) -> float:
    """
    Computes standard deviation of daily duty hours over trailing 28 days.
    High irregularity reflects erratic, disrupted operational schedules.
    """
    target_id = _str_id(pseudonymous_id)
    as_of = _parse_date(as_of_date)
    start_date = as_of - datetime.timedelta(days=window_days - 1)

    if duty_df.empty:
        return 0.0

    if not isinstance(duty_df["record_date"].iloc[0], datetime.date):
        duty_dates = pd.to_datetime(duty_df["record_date"]).dt.date
    else:
        duty_dates = duty_df["record_date"]

    mask = (
        (duty_df["pseudonymous_id"].astype(str).str.lower() == target_id)
        & (duty_dates >= start_date)
        & (duty_dates <= as_of)
    )
    subset = duty_df[mask]

    if len(subset) <= 1:
        return 0.0

    return float(round(float(subset["duty_hours"].std()), 2))


def compute_workload_trend_4wk(
    duty_df: pd.DataFrame,
    pseudonymous_id: Union[str, uuid.UUID],
    as_of_date: Union[datetime.date, str],
) -> float:
    """
    Computes relative change between current 4-week duty hours and prior 4-week duty hours:
    (hours_current_4wk - hours_prior_4wk) / max(hours_prior_4wk, 1.0)
    """
    as_of = _parse_date(as_of_date)
    prior_as_of = as_of - datetime.timedelta(days=28)

    current_hours = compute_total_duty_hours_4wk(duty_df, pseudonymous_id, as_of, window_days=28)
    prior_hours = compute_total_duty_hours_4wk(duty_df, pseudonymous_id, prior_as_of, window_days=28)

    if prior_hours <= 0.0:
        return 0.0

    trend = (current_hours - prior_hours) / prior_hours
    return float(round(trend, 4))


# =============================================================================
# 2. Leave Records Features (leave_records)
# =============================================================================

def compute_days_since_last_leave(
    leave_df: pd.DataFrame,
    pseudonymous_id: Union[str, uuid.UUID],
    as_of_date: Union[datetime.date, str],
    default_days: float = 365.0,
) -> float:
    """
    Computes the number of days between as_of_date and the end of the most
    recent completed leave period.

    If currently active on leave on as_of_date, returns 0.0.
    If no prior leave is recorded, returns default_days (default 365.0).
    """
    target_id = _str_id(pseudonymous_id)
    as_of = _parse_date(as_of_date)

    if leave_df.empty:
        return default_days

    # Parse dates if needed
    start_dates = (
        pd.to_datetime(leave_df["start_date"]).dt.date
        if not isinstance(leave_df["start_date"].iloc[0], datetime.date)
        else leave_df["start_date"]
    )
    end_dates = (
        pd.to_datetime(leave_df["end_date"]).dt.date
        if not isinstance(leave_df["end_date"].iloc[0], datetime.date)
        else leave_df["end_date"]
    )

    mask = (
        (leave_df["pseudonymous_id"].astype(str).str.lower() == target_id)
        & (start_dates <= as_of)
    )
    subset = leave_df[mask]

    if subset.empty:
        return default_days

    subset_starts = start_dates[mask]
    subset_ends = end_dates[mask]

    # Check if currently active on leave
    for s_date, e_date in zip(subset_starts, subset_ends):
        if s_date <= as_of <= e_date:
            return 0.0

    # Otherwise, find max end date among completed leaves
    max_end = max(subset_ends)
    if max_end <= as_of:
        return float((as_of - max_end).days)
    else:
        # Leave started on or before as_of but ends after as_of -> currently on leave
        return 0.0


def compute_leave_utilization_rate(
    leave_df: pd.DataFrame,
    pseudonymous_id: Union[str, uuid.UUID],
    as_of_date: Union[datetime.date, str],
    annual_entitlement_days: float = 30.0,
    window_days: int = 365,
) -> float:
    """
    Computes leave utilization rate: (total leave days taken in trailing 365d) / annual_entitlement.
    """
    target_id = _str_id(pseudonymous_id)
    as_of = _parse_date(as_of_date)
    window_start = as_of - datetime.timedelta(days=window_days)

    if leave_df.empty:
        return 0.0

    start_dates = (
        pd.to_datetime(leave_df["start_date"]).dt.date
        if not isinstance(leave_df["start_date"].iloc[0], datetime.date)
        else leave_df["start_date"]
    )
    end_dates = (
        pd.to_datetime(leave_df["end_date"]).dt.date
        if not isinstance(leave_df["end_date"].iloc[0], datetime.date)
        else leave_df["end_date"]
    )

    mask = (
        (leave_df["pseudonymous_id"].astype(str).str.lower() == target_id)
        & (start_dates <= as_of)
        & (end_dates >= window_start)
    )
    subset = leave_df[mask]

    if subset.empty:
        return 0.0

    total_days = 0
    for s_date, e_date in zip(start_dates[mask], end_dates[mask]):
        # Clip leave interval to window [window_start, as_of]
        eff_start = max(s_date, window_start)
        eff_end = min(e_date, as_of)
        if eff_end >= eff_start:
            total_days += (eff_end - eff_start).days + 1

    rate = total_days / max(annual_entitlement_days, 1.0)
    return float(round(rate, 3))


# =============================================================================
# 3. Deployment Features (deployments)
# =============================================================================

def compute_deployment_duration_days(
    deployments_df: pd.DataFrame,
    pseudonymous_id: Union[str, uuid.UUID],
    as_of_date: Union[datetime.date, str],
) -> int:
    """
    Computes the elapsed days of active deployment on as_of_date.
    Returns 0 if the individual is not currently deployed on as_of_date.
    """
    target_id = _str_id(pseudonymous_id)
    as_of = _parse_date(as_of_date)

    if deployments_df.empty:
        return 0

    start_dates = (
        pd.to_datetime(deployments_df["start_date"]).dt.date
        if not isinstance(deployments_df["start_date"].iloc[0], datetime.date)
        else deployments_df["start_date"]
    )

    mask = (
        (deployments_df["pseudonymous_id"].astype(str).str.lower() == target_id)
        & (start_dates <= as_of)
    )
    subset = deployments_df[mask]

    if subset.empty:
        return 0

    for idx, row in subset.iterrows():
        s_date = start_dates.loc[idx]
        e_val = row.get("end_date")
        if pd.isna(e_val) or e_val is None:
            # Open-ended / ongoing deployment
            return (as_of - s_date).days
        else:
            e_date = _parse_date(e_val)
            if e_date >= as_of:
                return (as_of - s_date).days

    return 0


def compute_active_deployment_hardship(
    deployments_df: pd.DataFrame,
    pseudonymous_id: Union[str, uuid.UUID],
    as_of_date: Union[datetime.date, str],
) -> int:
    """Returns hardship level (1 to 5) of currently active deployment, or 0 if not deployed."""
    target_id = _str_id(pseudonymous_id)
    as_of = _parse_date(as_of_date)

    if deployments_df.empty:
        return 0

    start_dates = (
        pd.to_datetime(deployments_df["start_date"]).dt.date
        if not isinstance(deployments_df["start_date"].iloc[0], datetime.date)
        else deployments_df["start_date"]
    )

    mask = (
        (deployments_df["pseudonymous_id"].astype(str).str.lower() == target_id)
        & (start_dates <= as_of)
    )
    subset = deployments_df[mask]

    if subset.empty:
        return 0

    for idx, row in subset.iterrows():
        s_date = start_dates.loc[idx]
        e_val = row.get("end_date")
        hardship = int(row.get("hardship_level", 1))
        if pd.isna(e_val) or e_val is None:
            return hardship
        else:
            e_date = _parse_date(e_val)
            if e_date >= as_of:
                return hardship

    return 0


# =============================================================================
# 4. Transfer Features (transfers)
# =============================================================================

def compute_transfers_last_12mo(
    transfers_df: pd.DataFrame,
    pseudonymous_id: Union[str, uuid.UUID],
    as_of_date: Union[datetime.date, str],
    window_days: int = 365,
) -> int:
    """
    Counts the number of unit transfer records in the trailing 365-day window:
    [as_of_date - window_days, as_of_date].
    """
    target_id = _str_id(pseudonymous_id)
    as_of = _parse_date(as_of_date)
    start_date = as_of - datetime.timedelta(days=window_days)

    if transfers_df.empty:
        return 0

    t_dates = (
        pd.to_datetime(transfers_df["transfer_date"]).dt.date
        if not isinstance(transfers_df["transfer_date"].iloc[0], datetime.date)
        else transfers_df["transfer_date"]
    )

    mask = (
        (transfers_df["pseudonymous_id"].astype(str).str.lower() == target_id)
        & (t_dates >= start_date)
        & (t_dates <= as_of)
    )
    return int(mask.sum())


# =============================================================================
# 5. Training Load Features (training_records)
# =============================================================================

def compute_training_load_4wk(
    training_df: pd.DataFrame,
    pseudonymous_id: Union[str, uuid.UUID],
    as_of_date: Union[datetime.date, str],
    window_days: int = 28,
) -> float:
    """
    Computes total training hours committed over the trailing 28-day window:
    [as_of_date - (window_days - 1), as_of_date].
    """
    target_id = _str_id(pseudonymous_id)
    as_of = _parse_date(as_of_date)
    start_date = as_of - datetime.timedelta(days=window_days - 1)

    if training_df.empty:
        return 0.0

    tr_dates = (
        pd.to_datetime(training_df["training_date"]).dt.date
        if not isinstance(training_df["training_date"].iloc[0], datetime.date)
        else training_df["training_date"]
    )

    mask = (
        (training_df["pseudonymous_id"].astype(str).str.lower() == target_id)
        & (tr_dates >= start_date)
        & (tr_dates <= as_of)
    )
    subset = training_df[mask]

    if subset.empty:
        return 0.0

    return float(round(float(subset["hours_committed"].sum()), 2))


# =============================================================================
# 6. Wellness Assessment Features (wellness_assessments)
# =============================================================================

def _get_wellness_history_up_to_date(
    wellness_df: pd.DataFrame,
    pseudonymous_id: Union[str, uuid.UUID],
    as_of_date: Union[datetime.date, str],
) -> pd.DataFrame:
    """Returns sorted wellness submissions for a user on or before as_of_date."""
    target_id = _str_id(pseudonymous_id)
    as_of = _parse_date(as_of_date)

    if wellness_df.empty:
        return pd.DataFrame()

    # Create end of as_of_date UTC timestamp
    as_of_eod = pd.Timestamp(
        datetime.datetime.combine(as_of, datetime.time(23, 59, 59, 999999)),
        tz="UTC",
    )

    sub_dates = pd.to_datetime(wellness_df["submitted_at"], utc=True)
    mask = (
        (wellness_df["pseudonymous_id"].astype(str).str.lower() == target_id)
        & (sub_dates <= as_of_eod)
    )
    subset = wellness_df[mask].copy()
    if subset.empty:
        return pd.DataFrame()

    subset["submitted_dt"] = sub_dates[mask]
    return subset.sort_values("submitted_dt", ascending=True)


def compute_wellness_score_trend(
    wellness_df: pd.DataFrame,
    pseudonymous_id: Union[str, uuid.UUID],
    as_of_date: Union[datetime.date, str],
    max_submissions: int = 3,
) -> float:
    """
    Computes the linear slope of self-reported mood_score over the trailing
    3 submissions (or available submissions if 2).

    Slope > 0 indicates improving mood; slope < 0 indicates deteriorating mood.
    Returns 0.0 if fewer than 2 submissions exist.
    """
    history = _get_wellness_history_up_to_date(wellness_df, pseudonymous_id, as_of_date)
    if len(history) < 2:
        return 0.0

    recent = history.tail(max_submissions)
    scores = recent["mood_score"].dropna().values.astype(float)
    if len(scores) < 2:
        return 0.0

    # OLS slope over submission indices [0, 1, ... n-1]
    n = len(scores)
    x = np.arange(n)
    slope = float(np.polyfit(x, scores, 1)[0])
    return float(round(slope, 3))


def compute_sleep_score_trend(
    wellness_df: pd.DataFrame,
    pseudonymous_id: Union[str, uuid.UUID],
    as_of_date: Union[datetime.date, str],
    max_submissions: int = 3,
) -> float:
    """
    Computes the linear slope of self-reported sleep_quality_score over trailing
    3 submissions.

    Slope < 0 indicates deteriorating sleep quality.
    Returns 0.0 if fewer than 2 submissions exist.
    """
    history = _get_wellness_history_up_to_date(wellness_df, pseudonymous_id, as_of_date)
    if len(history) < 2:
        return 0.0

    recent = history.tail(max_submissions)
    scores = recent["sleep_quality_score"].dropna().values.astype(float)
    if len(scores) < 2:
        return 0.0

    n = len(scores)
    x = np.arange(n)
    slope = float(np.polyfit(x, scores, 1)[0])
    return float(round(slope, 3))


def compute_stress_self_rating_trend(
    wellness_df: pd.DataFrame,
    pseudonymous_id: Union[str, uuid.UUID],
    as_of_date: Union[datetime.date, str],
    max_submissions: int = 3,
) -> float:
    """
    Computes slope of stress_self_rating (1-10) over trailing 3 submissions.
    Slope > 0 indicates escalating stress.
    """
    history = _get_wellness_history_up_to_date(wellness_df, pseudonymous_id, as_of_date)
    if len(history) < 2:
        return 0.0

    recent = history.tail(max_submissions)
    scores = recent["stress_self_rating"].dropna().values.astype(float)
    if len(scores) < 2:
        return 0.0

    n = len(scores)
    x = np.arange(n)
    slope = float(np.polyfit(x, scores, 1)[0])
    return float(round(slope, 3))


def compute_sudden_wellness_drop(
    wellness_df: pd.DataFrame,
    pseudonymous_id: Union[str, uuid.UUID],
    as_of_date: Union[datetime.date, str],
    mood_drop_threshold: int = 2,
) -> int:
    """
    Returns 1 if the latest self-reported mood_score dropped by >= mood_drop_threshold
    points compared to the immediately preceding submission; returns 0 otherwise.
    """
    history = _get_wellness_history_up_to_date(wellness_df, pseudonymous_id, as_of_date)
    if len(history) < 2:
        return 0

    recent_2 = history.tail(2)
    prev_mood = recent_2["mood_score"].iloc[0]
    curr_mood = recent_2["mood_score"].iloc[1]

    if pd.isna(prev_mood) or pd.isna(curr_mood):
        return 0

    drop = int(prev_mood) - int(curr_mood)
    return 1 if drop >= mood_drop_threshold else 0


def compute_latest_wellness_metrics(
    wellness_df: pd.DataFrame,
    pseudonymous_id: Union[str, uuid.UUID],
    as_of_date: Union[datetime.date, str],
) -> Dict[str, Any]:
    """
    Extracts snapshot values from the latest submission on or before as_of_date.
    """
    history = _get_wellness_history_up_to_date(wellness_df, pseudonymous_id, as_of_date)
    as_of = _parse_date(as_of_date)

    if history.empty:
        return {
            "latest_mood_score": 3.0,
            "latest_sleep_quality": 3.0,
            "latest_stress_self_rating": 3.0,
            "help_requested_recent": 0,
            "self_report_recency_days": 30.0,
        }

    latest = history.iloc[-1]
    latest_date = latest["submitted_dt"].date()
    recency_days = float((as_of - latest_date).days)

    # Check help requested in trailing 30 days
    start_30d = pd.Timestamp(
        datetime.datetime.combine(as_of - datetime.timedelta(days=30), datetime.time(0, 0, 0)),
        tz="UTC",
    )
    trailing_30d = history[history["submitted_dt"] >= start_30d]
    help_requested_recent = int(trailing_30d["help_requested"].fillna(False).any())

    return {
        "latest_mood_score": float(latest.get("mood_score", 3.0) or 3.0),
        "latest_sleep_quality": float(latest.get("sleep_quality_score", 3.0) or 3.0),
        "latest_stress_self_rating": float(latest.get("stress_self_rating", 3.0) or 3.0),
        "help_requested_recent": help_requested_recent,
        "self_report_recency_days": recency_days,
    }


# =============================================================================
# Master Feature Extractor
# =============================================================================

def compute_all_features_for_person(
    tables: Dict[str, pd.DataFrame],
    pseudonymous_id: Union[str, uuid.UUID],
    as_of_date: Union[datetime.date, str],
) -> Dict[str, Any]:
    """
    Computes all Section 4 and Section 9 engineered features for a specific individual
    as of a given historical or current date with zero temporal leakage.

    Args:
        tables: Dictionary containing DataFrames for:
                'duty_records', 'leave_records', 'deployments',
                'transfers', 'training_records', 'wellness_assessments'.
        pseudonymous_id: Target person's analytics identifier.
        as_of_date: Point-in-time timestamp (all future data strictly excluded).

    Returns:
        Dictionary mapping feature names to numerical values.
    """
    pid = _str_id(pseudonymous_id)
    as_of = _parse_date(as_of_date)

    duty_df = tables.get("duty_records", pd.DataFrame())
    leave_df = tables.get("leave_records", pd.DataFrame())
    deploy_df = tables.get("deployments", pd.DataFrame())
    transfers_df = tables.get("transfers", pd.DataFrame())
    training_df = tables.get("training_records", pd.DataFrame())
    wellness_df = tables.get("wellness_assessments", pd.DataFrame())

    # 1. Section 4 Core Features
    avg_duty_hours_4wk = compute_avg_duty_hours_4wk(duty_df, pid, as_of)
    consecutive_night_shifts = compute_consecutive_night_shifts(duty_df, pid, as_of)
    days_since_last_leave = compute_days_since_last_leave(leave_df, pid, as_of)
    deployment_duration_days = compute_deployment_duration_days(deploy_df, pid, as_of)
    transfers_last_12mo = compute_transfers_last_12mo(transfers_df, pid, as_of)
    training_load_4wk = compute_training_load_4wk(training_df, pid, as_of)
    wellness_score_trend = compute_wellness_score_trend(wellness_df, pid, as_of)
    sleep_score_trend = compute_sleep_score_trend(wellness_df, pid, as_of)
    sudden_wellness_drop = compute_sudden_wellness_drop(wellness_df, pid, as_of)

    # 2. Section 9 Extended Features
    total_duty_hours_4wk = compute_total_duty_hours_4wk(duty_df, pid, as_of)
    duty_irregularity_index = compute_duty_irregularity_index(duty_df, pid, as_of)
    workload_trend_4wk = compute_workload_trend_4wk(duty_df, pid, as_of)
    leave_utilization_rate = compute_leave_utilization_rate(leave_df, pid, as_of)
    active_hardship = compute_active_deployment_hardship(deploy_df, pid, as_of)
    stress_trend = compute_stress_self_rating_trend(wellness_df, pid, as_of)
    wellness_snapshot = compute_latest_wellness_metrics(wellness_df, pid, as_of)

    return {
        "pseudonymous_id": pid,
        "as_of_date": as_of.isoformat(),
        # Section 4 features
        "avg_duty_hours_4wk": avg_duty_hours_4wk,
        "consecutive_night_shifts": consecutive_night_shifts,
        "days_since_last_leave": days_since_last_leave,
        "deployment_duration_days": deployment_duration_days,
        "transfers_last_12mo": transfers_last_12mo,
        "training_load_4wk": training_load_4wk,
        "wellness_score_trend": wellness_score_trend,
        "sleep_score_trend": sleep_score_trend,
        "sudden_wellness_drop": sudden_wellness_drop,
        # Section 9 extended features
        "total_duty_hours_4wk": total_duty_hours_4wk,
        "duty_irregularity_index": duty_irregularity_index,
        "workload_trend_4wk": workload_trend_4wk,
        "leave_utilization_rate": leave_utilization_rate,
        "active_deployment_hardship": active_hardship,
        "stress_self_rating_trend": stress_trend,
        "latest_mood_score": wellness_snapshot["latest_mood_score"],
        "latest_sleep_quality": wellness_snapshot["latest_sleep_quality"],
        "latest_stress_self_rating": wellness_snapshot["latest_stress_self_rating"],
        "help_requested_recent": wellness_snapshot["help_requested_recent"],
        "self_report_recency_days": wellness_snapshot["self_report_recency_days"],
    }
