"""
Phase 10: Master Dataset & Personnel Analytics API Router.

Provides:
- GET /api/dataset/status: Active dataset metadata and model version.
- POST /api/dataset/upload: Uploads and validates a CSV/XLSX master dataset file.
- POST /api/dataset/train: Retrains the XGBoost model on the uploaded dataset and refreshes in-memory predictions.
- GET /api/personnel: Lists all unique personnel with latest stress score, welfare risk score, and risk category.
- GET /api/personnel/{person_id}: Complete profile of the person's latest observation, SHAP factors, and recommendations.
- GET /api/personnel/{person_id}/history: Longitudinal timeline for trend charts.
"""

import io
from typing import Any, Dict, List, Optional
import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.jwt_auth import get_current_user_claims, require_roles
from app.master_data import master_manager

router = APIRouter(prefix="/api", tags=["Master Dataset & Risk Intelligence"])

# In-memory storage for pending uploaded dataset before user clicks "Train & Predict"
_PENDING_UPLOAD: Dict[str, Any] = {
    "filename": "",
    "content": b"",
    "df": None,
    "validation": None,
}


@router.get("/dataset/status")
def get_dataset_status(claims: dict = Depends(get_current_user_claims)):
    """Returns the currently active dataset name, model version, records, and training time."""
    return master_manager.get_status()


@router.post("/dataset/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    claims: dict = Depends(require_roles(["admin", "welfare_officer"])),
):
    """
    Uploads a master dataset file (CSV or XLSX), performs schema & data validation,
    and returns a preview without retraining immediately.
    """
    filename = file.filename or "uploaded_dataset.csv"
    if not (filename.lower().endswith(".csv") or filename.lower().endswith(".xlsx") or filename.lower().endswith(".xls")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Please upload a .csv or .xlsx / .xls file.",
        )

    content = await file.read()
    try:
        if filename.lower().endswith(".xlsx") or filename.lower().endswith(".xls"):
            df = pd.read_excel(io.BytesIO(content))
        else:
            df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to parse dataset file: {str(e)}",
        )

    val = master_manager.validate_dataset(df)

    # Store in pending upload state
    _PENDING_UPLOAD["filename"] = filename
    _PENDING_UPLOAD["content"] = content
    _PENDING_UPLOAD["df"] = df
    _PENDING_UPLOAD["validation"] = val

    # Preview top 5 rows with selected columns
    preview_cols = [c for c in ["person_id", "record_date", "unit_id", "role", "stress_score", "duty_hours", "sleep_hours"] if c in df.columns]
    preview_sample = df[preview_cols].head(5).to_dict(orient="records")

    return {
        "status": "validated",
        "filename": filename,
        "row_count": len(df),
        "personnel_count": val["personnel_count"],
        "validation": val,
        "preview_sample": preview_sample,
    }


@router.post("/dataset/train")
def train_and_predict(
    claims: dict = Depends(require_roles(["admin", "welfare_officer"])),
):
    """
    Executes actual retraining of the calibrated XGBoost model and TreeSHAP explainer
    on the currently uploaded dataset. Updates the active in-memory session.
    """
    if not _PENDING_UPLOAD["content"] or _PENDING_UPLOAD["df"] is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending dataset uploaded. Please upload a valid CSV/XLSX file first.",
        )

    val = _PENDING_UPLOAD["validation"]
    if not val or not val.get("valid"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Uploaded dataset failed validation: {'; '.join(val.get('errors', []))}",
        )

    try:
        result = master_manager.train_uploaded_dataset(
            file_content=_PENDING_UPLOAD["content"],
            filename=_PENDING_UPLOAD["filename"],
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Model training failed: {str(e)}",
        )


@router.get("/personnel")
def list_all_personnel(claims: dict = Depends(get_current_user_claims)):
    """
    Lists all unique personnel in the active master dataset with their latest
    stress score, predicted welfare risk score, and risk category.
    """
    return master_manager.get_all_personnel_latest()


@router.get("/personnel/{person_id}")
def get_personnel_detail(person_id: str, claims: dict = Depends(get_current_user_claims)):
    """
    Returns complete latest observation, top 5 SHAP factors, recommendations,
    and categorized attributes for a specific individual.
    """
    detail = master_manager.get_person_detail(person_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Personnel with ID '{person_id}' not found in active master dataset.",
        )
    return detail


@router.get("/personnel/{person_id}/history")
def get_personnel_history(person_id: str, claims: dict = Depends(get_current_user_claims)):
    """
    Returns all longitudinal observations for a person with observed stress
    and model-predicted welfare risk across record dates.
    """
    history = master_manager.get_person_history(person_id)
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Historical observations for '{person_id}' not found.",
        )
    return history
