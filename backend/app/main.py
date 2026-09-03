"""
Entry point for the Welfare Monitoring System backend.

Task 1.1 scope only: a placeholder FastAPI app + a /health endpoint,
so we have proof that the container, the app, and Docker Compose
networking all actually work before any real logic gets added.
"""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI

from app.auth import router as auth_router
from app.hr import router as hr_router
from app.wellness import router as wellness_router
from app.jwt_auth import get_current_user_claims, require_roles
from app.risk import load_risk_model


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan event handler for FastAPI.
    Loads the trained calibrated XGBoost risk model artifact (model.joblib)
    into memory on startup (Phase 6.1).
    """
    app.state.risk_model = load_risk_model()
    yield


app = FastAPI(
    title="Welfare Monitoring System API",
    description="MVP backend for the Personnel Stress & Welfare Monitoring System",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(auth_router)
app.include_router(hr_router)
app.include_router(wellness_router)


# ---------------------------------------------------------------------------
# Task 2.3 dummy protected routes for RBAC verification
# ---------------------------------------------------------------------------

@app.get("/dummy/personnel-only")
def dummy_personnel_only(claims: dict = Depends(require_roles(["personnel"]))):
    """Accessible ONLY by users with 'personnel' role."""
    return {
        "message": "Access granted: personnel route",
        "person_id": claims.get("person_id"),
        "role": claims.get("role"),
    }


@app.get("/dummy/welfare-officer-only")
def dummy_welfare_officer_only(
    claims: dict = Depends(require_roles(["welfare_officer"])),
):
    """Accessible ONLY by users with 'welfare_officer' role."""
    return {
        "message": "Access granted: welfare_officer route",
        "person_id": claims.get("person_id"),
        "role": claims.get("role"),
    }


@app.get("/dummy/authenticated")
def dummy_authenticated(claims: dict = Depends(get_current_user_claims)):
    """Accessible by ANY valid authenticated JWT regardless of role."""
    return {
        "message": "Access granted: authenticated user",
        "person_id": claims.get("person_id"),
        "pseudonymous_id": claims.get("pseudonymous_id"),
        "role": claims.get("role"),
    }


@app.get("/health")
def health_check():
    """
    Basic liveness check.
    Returns 200 + a simple payload if the app process is up and serving requests.
    Does NOT check the database yet — that comes in Phase 1.2 once
    the DB schema/migrations exist. For now this only proves the
    backend container itself boots correctly under Docker Compose.
    """
    return {"status": "ok", "service": "welfare-monitoring-backend"}


@app.get("/")
def root():
    return {"message": "Welfare Monitoring System API — see /docs for endpoints"}

