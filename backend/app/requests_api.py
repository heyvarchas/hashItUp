"""
Change Requests and In-App Notifications API Router.

Endpoints:
- POST /requests: Create a change request (Personnel). Snapshots ML risk, stress, and SHAP factors without retraining.
- GET /requests/my: Get logged-in user's change requests.
- GET /requests/pending: Get all pending change requests (Welfare Officers / Admin).
- GET /requests/{id}: Get detailed request info with snapshot factors & recommendations.
- PATCH /requests/{id}/decision: Approve or reject request with optional officer reasoning.
- GET /notifications: Get notifications for current user (or welfare officer role).
- PATCH /notifications/{id}/read: Mark a notification as read.
- POST /notifications/read-all: Mark all notifications as read for current user.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.decision_support import generate_change_request_recommendation
from app.jwt_auth import get_current_user_claims, require_roles
from app.master_data import master_manager
from app.models import ChangeRequest, Notification, Personnel, RiskScore, WellnessAssessment
from app.schemas import (
    ChangeRequestCreate,
    ChangeRequestDecision,
    ChangeRequestOut,
    NotificationOut,
)

router = APIRouter(tags=["Change Requests & Notifications"])


def _resolve_caller_person_id(claims: dict, db: Session) -> str:
    """
    Finds the user's service_number or master person_id from claims.
    """
    token_person_id = claims.get("person_id")
    if token_person_id:
        try:
            person_uuid = uuid.UUID(str(token_person_id))
            person = db.query(Personnel).filter(Personnel.person_id == person_uuid).first()
            if person:
                return person.service_number
        except (ValueError, AttributeError):
            # Check if token_person_id directly matches service_number
            person = db.query(Personnel).filter(Personnel.service_number == str(token_person_id)).first()
            if person:
                return person.service_number
    return str(token_person_id or "UNKNOWN")


def _get_latest_metrics_for_person(person_id_or_sn: str, db: Session) -> Tuple[int, int, List[Dict[str, Any]]]:
    """
    Extracts latest welfare risk score, stress score, and contributing SHAP factors.
    First checks MasterDataManager. If not found, checks database RiskScore and WellnessAssessment.
    """
    # 1. Try master_manager
    detail = master_manager.get_person_detail(person_id_or_sn)
    if detail:
        risk_score = int(detail["welfare_risk"]["welfare_risk_score"])
        stress_score = int(detail["wellness"]["stress_score"])
        shap_factors = detail.get("shap_factors", [])
        return risk_score, stress_score, shap_factors

    # 2. Try DB lookup via service_number
    person = db.query(Personnel).filter(Personnel.service_number == person_id_or_sn).first()
    if person:
        # Latest RiskScore
        latest_risk = (
            db.query(RiskScore)
            .filter(RiskScore.pseudonymous_id == person.pseudonymous_id)
            .order_by(RiskScore.computed_at.desc())
            .first()
        )
        # Latest Wellness
        latest_well = (
            db.query(WellnessAssessment)
            .filter(WellnessAssessment.pseudonymous_id == person.pseudonymous_id)
            .order_by(WellnessAssessment.submitted_at.desc())
            .first()
        )

        risk_val = int(latest_risk.calibrated_score) if latest_risk else 45
        stress_val = int(latest_well.stress_self_rating) if (latest_well and latest_well.stress_self_rating) else 5

        # Build factors from risk score contributing factors or default
        factors = []
        if latest_risk and latest_risk.contributing_factors:
            for item in latest_risk.contributing_factors:
                if isinstance(item, dict):
                    factors.append(item)
                else:
                    factors.append({
                        "raw_feature": "clinical_factor",
                        "display_name": str(item),
                        "points_impact": 15,
                        "impact_direction": "elevates_risk",
                        "actual_value": None,
                    })
        if not factors:
            factors = [
                {"display_name": "Leave gap (days)", "points_impact": 18, "impact_direction": "elevates_risk"},
                {"display_name": "Night-shift frequency (30d)", "points_impact": 14, "impact_direction": "elevates_risk"},
                {"display_name": "Duty-hours deviation", "points_impact": 11, "impact_direction": "elevates_risk"},
                {"display_name": "Sleep deviation from baseline", "points_impact": 9, "impact_direction": "elevates_risk"},
            ]
        return risk_val, stress_val, factors

    # Default fallback
    return 50, 5, [
        {"display_name": "Duty hours", "points_impact": 10, "impact_direction": "elevates_risk"}
    ]


# ---------------------------------------------------------------------------
# Employee Endpoints
# ---------------------------------------------------------------------------

@router.post("/requests", response_model=ChangeRequestOut, status_code=status.HTTP_201_CREATED)
def create_change_request(
    payload: ChangeRequestCreate,
    claims: dict = Depends(require_roles(["personnel"])),
    db: Session = Depends(get_db),
):
    """
    Submits a new change request for the calling personnel.
    Snapshots the employee's current risk, stress, and top SHAP factors at submission time.
    Generates decision-support recommendation without modifying the ML model.
    """
    person_identifier = _resolve_caller_person_id(claims, db)

    # Pack extra note into details if supplied
    details = dict(payload.request_details)
    if payload.additional_note:
        details["additional_note"] = payload.additional_note

    # Get latest ML & wellness telemetry snapshot
    risk_score, stress_score, factors = _get_latest_metrics_for_person(person_identifier, db)

    # Generate Decision Support recommendation
    rec_type, rec_reason = generate_change_request_recommendation(
        request_type=payload.request_type,
        request_details=details,
        risk_score=risk_score,
        stress_score=stress_score,
        contributing_factors=factors,
    )

    new_req = ChangeRequest(
        request_id=uuid.uuid4(),
        person_id=person_identifier,
        request_type=payload.request_type.lower().strip(),
        request_details=details,
        reason=payload.reason,
        status="PENDING",
        risk_score_at_submission=risk_score,
        stress_score_at_submission=stress_score,
        contributing_factors_at_submission=factors,
        system_recommendation=rec_type,
        recommendation_reason=rec_reason,
        submitted_at=datetime.datetime.now(datetime.timezone.utc),
        notification_status="PENDING",
    )
    db.add(new_req)

    # 1. Notification for Employee confirming submission
    notif_emp = Notification(
        notification_id=uuid.uuid4(),
        recipient_id=person_identifier,
        recipient_role="personnel",
        title="Request Submitted",
        message=f"Your {payload.request_type.replace('_', ' ')} request has been submitted and is pending officer review.",
        request_id=new_req.request_id,
        is_read=False,
    )
    db.add(notif_emp)

    # 2. Notification for Welfare Officers
    notif_officer = Notification(
        notification_id=uuid.uuid4(),
        recipient_id="welfare_officer",
        recipient_role="welfare_officer",
        title="New Change Request",
        message=f"New {payload.request_type.replace('_', ' ')} request submitted by {person_identifier} (Risk: {risk_score}/100).",
        request_id=new_req.request_id,
        is_read=False,
    )
    db.add(notif_officer)

    db.commit()
    db.refresh(new_req)
    return new_req


@router.get("/requests/my", response_model=List[ChangeRequestOut])
def get_my_requests(
    claims: dict = Depends(require_roles(["personnel"])),
    db: Session = Depends(get_db),
):
    """
    Returns all change requests submitted by the logged-in personnel user.
    """
    person_identifier = _resolve_caller_person_id(claims, db)
    requests = (
        db.query(ChangeRequest)
        .filter(ChangeRequest.person_id == person_identifier)
        .order_by(ChangeRequest.submitted_at.desc())
        .all()
    )
    return requests


# ---------------------------------------------------------------------------
# Welfare Officer Endpoints
# ---------------------------------------------------------------------------

@router.get("/requests/pending", response_model=List[ChangeRequestOut])
def get_pending_requests(
    claims: dict = Depends(require_roles(["welfare_officer", "admin"])),
    db: Session = Depends(get_db),
):
    """
    Lists all pending change requests awaiting welfare officer review.
    """
    requests = (
        db.query(ChangeRequest)
        .filter(ChangeRequest.status == "PENDING")
        .order_by(ChangeRequest.submitted_at.desc())
        .all()
    )
    return requests


@router.get("/requests", response_model=List[ChangeRequestOut])
def get_all_requests(
    status_filter: Optional[str] = None,
    request_type: Optional[str] = None,
    claims: dict = Depends(require_roles(["welfare_officer", "admin"])),
    db: Session = Depends(get_db),
):
    """
    Lists all change requests with optional status and request_type filters for welfare officers.
    """
    query = db.query(ChangeRequest)
    if status_filter and status_filter.upper() != "ALL":
        query = query.filter(ChangeRequest.status == status_filter.upper())
    if request_type and request_type.lower() != "all":
        query = query.filter(ChangeRequest.request_type == request_type.lower())

    requests = query.order_by(ChangeRequest.submitted_at.desc()).all()
    return requests


@router.get("/requests/history", response_model=List[ChangeRequestOut])
def get_decided_requests_history(
    claims: dict = Depends(require_roles(["welfare_officer", "admin"])),
    db: Session = Depends(get_db),
):
    """
    Lists all resolved/decided change requests (APPROVED / REJECTED) for auditing.
    """
    requests = (
        db.query(ChangeRequest)
        .filter(ChangeRequest.status != "PENDING")
        .order_by(ChangeRequest.decided_at.desc())
        .all()
    )
    return requests


@router.get("/requests/{request_id}", response_model=ChangeRequestOut)
def get_request_details(
    request_id: uuid.UUID,
    claims: dict = Depends(get_current_user_claims),
    db: Session = Depends(get_db),
):
    """
    Retrieves full details of a specific request including submission-time snapshot.
    Accessible by the submitting employee, or welfare officers / admins.
    """
    req = db.query(ChangeRequest).filter(ChangeRequest.request_id == request_id).first()
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Change request not found",
        )

    # Permission check: personnel can only view their own
    caller_role = claims.get("role")
    if caller_role == "personnel":
        caller_id = _resolve_caller_person_id(claims, db)
        if req.person_id != caller_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to view another employee's request",
            )

    return req


@router.patch("/requests/{request_id}/decision", response_model=ChangeRequestOut)
def decide_request(
    request_id: uuid.UUID,
    payload: ChangeRequestDecision,
    claims: dict = Depends(require_roles(["welfare_officer", "admin"])),
    db: Session = Depends(get_db),
):
    """
    Approves or rejects a change request with optional decision reason.
    Stores officer decision, timestamp, and sends an in-app notification to the employee.
    """
    req = db.query(ChangeRequest).filter(ChangeRequest.request_id == request_id).first()
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Change request not found",
        )

    if req.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Request is already decided ({req.status}) and cannot be edited",
        )

    decision_clean = payload.decision.upper().strip()
    if decision_clean not in ("APPROVED", "REJECTED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decision must be either 'APPROVED' or 'REJECTED'",
        )

    if decision_clean == "REJECTED" and (not payload.reason or not payload.reason.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A decision reason is required when rejecting a request.",
        )

    officer_id = _resolve_caller_person_id(claims, db)

    req.status = decision_clean
    req.officer_decision = decision_clean
    req.officer_reason = payload.reason.strip() if payload.reason else None
    req.decided_by_person_id = officer_id
    req.decided_at = datetime.datetime.now(datetime.timezone.utc)
    req.notification_status = "NOTIFIED"

    # Create in-app notification for the employee
    req_label = req.request_type.replace("_", " ").title()
    if req.request_type == "work_hours":
        cur_h = req.request_details.get("current_hours", 10)
        req_h = req.request_details.get("requested_hours", 8)
        change_desc = f"to change duty hours from {cur_h} hours/day to {req_h} hours/day"
    elif req.request_type == "leave":
        days = req.request_details.get("leave_days", 5)
        l_type = req.request_details.get("leave_type", "Casual Leave")
        change_desc = f"for {days} days of {l_type}"
    elif req.request_type == "transfer":
        posting = req.request_details.get("requested_posting", "Requested Unit")
        change_desc = f"for transfer to {posting}"
    elif req.request_type == "day_to_night":
        change_desc = "for Day → Night shift change"
    elif req.request_type == "night_to_day":
        change_desc = "for Night → Day shift change"
    else:
        change_desc = f"for {req_label}"

    if decision_clean == "APPROVED":
        notif_title = "Request Approved"
        notif_msg = f"Your request {change_desc} has been approved by the Welfare Officer."
        if payload.reason:
            notif_msg += f"\nOfficer Note: {payload.reason}"
    else:
        notif_title = "Request Rejected"
        notif_msg = f"Your request {change_desc} was not approved."
        if payload.reason:
            notif_msg += f"\nReason: {payload.reason}"
        else:
            notif_msg += "\nReason: Current operational requirements do not permit the requested change at this time."

    emp_notif = Notification(
        notification_id=uuid.uuid4(),
        recipient_id=req.person_id,
        recipient_role="personnel",
        title=notif_title,
        message=notif_msg,
        request_id=req.request_id,
        is_read=False,
    )
    db.add(emp_notif)

    db.commit()
    db.refresh(req)
    return req


@router.post("/requests/{request_id}/approve", response_model=ChangeRequestOut)
def approve_request(
    request_id: uuid.UUID,
    payload: Optional[ChangeRequestDecision] = None,
    claims: dict = Depends(require_roles(["welfare_officer", "admin"])),
    db: Session = Depends(get_db),
):
    """
    POST alias to approve a change request.
    """
    decision_payload = ChangeRequestDecision(
        decision="APPROVED",
        reason=payload.reason if payload else None,
    )
    return decide_request(request_id, decision_payload, claims, db)


@router.post("/requests/{request_id}/reject", response_model=ChangeRequestOut)
def reject_request(
    request_id: uuid.UUID,
    payload: ChangeRequestDecision,
    claims: dict = Depends(require_roles(["welfare_officer", "admin"])),
    db: Session = Depends(get_db),
):
    """
    POST alias to reject a change request with mandatory/provided reason.
    """
    decision_payload = ChangeRequestDecision(
        decision="REJECTED",
        reason=payload.reason,
    )
    return decide_request(request_id, decision_payload, claims, db)


# ---------------------------------------------------------------------------
# Notification Endpoints
# ---------------------------------------------------------------------------

@router.get("/notifications", response_model=List[NotificationOut])
def get_user_notifications(
    claims: dict = Depends(get_current_user_claims),
    db: Session = Depends(get_db),
):
    """
    Returns in-app notifications for the logged-in user.
    Officers also receive broadcast officer notifications.
    """
    user_role = claims.get("role")
    person_identifier = _resolve_caller_person_id(claims, db)

    query = db.query(Notification)
    if user_role in ("welfare_officer", "admin"):
        # Welfare officers see notifications for their service number or general welfare officer alerts
        query = query.filter(
            (Notification.recipient_id == person_identifier) | 
            (Notification.recipient_id == "welfare_officer") |
            (Notification.recipient_role == "welfare_officer")
        )
    else:
        # Personnel only sees notifications addressed to them
        query = query.filter(Notification.recipient_id == person_identifier)

    notifications = query.order_by(Notification.created_at.desc()).limit(50).all()
    return notifications


@router.patch("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: uuid.UUID,
    claims: dict = Depends(get_current_user_claims),
    db: Session = Depends(get_db),
):
    """
    Marks a notification as read.
    """
    notif = db.query(Notification).filter(Notification.notification_id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    notif.is_read = True
    db.commit()
    return {"status": "ok", "message": "Notification marked as read"}


@router.post("/notifications/read-all")
def mark_all_notifications_read(
    claims: dict = Depends(get_current_user_claims),
    db: Session = Depends(get_db),
):
    """
    Marks all notifications for current user as read.
    """
    user_role = claims.get("role")
    person_identifier = _resolve_caller_person_id(claims, db)

    query = db.query(Notification).filter(Notification.is_read == False)
    if user_role in ("welfare_officer", "admin"):
        query = query.filter(
            (Notification.recipient_id == person_identifier) | 
            (Notification.recipient_id == "welfare_officer") |
            (Notification.recipient_role == "welfare_officer")
        )
    else:
        query = query.filter(Notification.recipient_id == person_identifier)

    query.update({Notification.is_read: True}, synchronize_session=False)
    db.commit()
    return {"status": "ok", "message": "All notifications marked as read"}
