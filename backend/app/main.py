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
from app.risk_api import router as risk_router
from app.alerts_api import router as alerts_router
from app.interventions_api import router as interventions_router
from app.dashboard_api import router as dashboard_router
from app.dataset_api import router as dataset_router
from app.requests_api import router as requests_router
from app.jwt_auth import get_current_user_claims, require_roles
from app.risk import load_risk_model
from app.master_data import master_manager



import logging
from pathlib import Path

logger = logging.getLogger("uvicorn")

@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    """
    Lifespan event handler for FastAPI.
    1. Runs database migrations (alembic upgrade head) so tables exist on fresh DB boots.
    2. Seeds demo persona and test credentials if database is empty.
    3. Loads the trained calibrated XGBoost risk model artifact into memory (Phase 6.1).
    """
    # 1. Run database migrations
    try:
        from alembic.config import Config
        from alembic import command
        from app.db import DATABASE_URL, SessionLocal, Base, engine
        import app.models  # noqa: F401

        alembic_ini_path = Path(__file__).resolve().parent.parent / "alembic.ini"
        if alembic_ini_path.exists():
            logger.info("Applying database migrations (alembic upgrade head)...")
            alembic_cfg = Config(str(alembic_ini_path))
            alembic_cfg.set_main_option("sqlalchemy.url", DATABASE_URL)
            command.upgrade(alembic_cfg, "head")
            logger.info("Database migrations applied successfully.")
        
        # Ensure all tables in models.py exist
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified.")
    except Exception as e:
        logger.warning(f"Could not apply migrations/create tables during startup: {e}")

    # 2. Check and seed demo persona / test credentials if DB is unseeded
    try:
        from app.models import Personnel
        from app.synthetic.demo_persona import seed_demo_persona

        db = SessionLocal()
        try:
            person_count = db.query(Personnel).count()
            if person_count == 0:
                logger.info("Database is empty. Auto-seeding scripted demo persona and test credentials...")
                seed_demo_persona(db)
                logger.info("Demo persona and test credentials seeded successfully.")
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"Could not auto-seed demo persona during startup: {e}")

    # 3. Initialize Single Master Dataset & Train Default Model
    try:
        master_manager.initialize_default()
        logger.info("Single Master Dataset loaded & Calibrated XGBoost + TreeSHAP pipeline activated.")
    except Exception as e:
        logger.warning(f"Could not initialize master dataset pipeline: {e}")

    # 4. Load legacy ML model if present (fallback)
    try:
        app_instance.state.risk_model = load_risk_model()
        logger.info("Calibrated XGBoost risk model loaded successfully.")
    except Exception as e:
        logger.warning(f"Could not load risk model artifact during startup: {e}")
        app_instance.state.risk_model = None
    yield



from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Welfare Monitoring System API",
    description="MVP backend for the Personnel Stress & Welfare Monitoring System",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(dataset_router)
app.include_router(hr_router)
app.include_router(wellness_router)
app.include_router(risk_router)
app.include_router(alerts_router)
app.include_router(interventions_router)
app.include_router(dashboard_router)
app.include_router(requests_router)





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


@app.get("/dummy/commander-only")
def dummy_commander_only(
    claims: dict = Depends(require_roles(["commander"])),
):
    """Accessible ONLY by users with 'commander' role."""
    return {
        "message": "Access granted: commander route",
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

