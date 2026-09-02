"""
Entry point for the Welfare Monitoring System backend.

Task 1.1 scope only: a placeholder FastAPI app + a /health endpoint,
so we have proof that the container, the app, and Docker Compose
networking all actually work before any real logic gets added.
"""

from fastapi import FastAPI

app = FastAPI(
    title="Welfare Monitoring System API",
    description="MVP backend for the Personnel Stress & Welfare Monitoring System",
    version="0.1.0",
)


@app.get("/health")
def health_check():
    """
    Basic liveness check.
    Returns 200 + a simple payload if the app process is up and serving requests.
    We are not checking the database yet — that comes in Phase 1.2 once
    the DB schema/migrations exist. For now this only proves the
    backend container itself boots correctly under Docker Compose.
    """
    return {"status": "ok", "service": "welfare-monitoring-backend"}


@app.get("/")
def root():
    return {"message": "Welfare Monitoring System API — see /docs for endpoints"}
