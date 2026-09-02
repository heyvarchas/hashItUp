"""
Authentication router: login and token issuance.

Task 2.2 scope: POST /auth/login
- Verifies credentials against identity.personnel and Argon2 password hashes.
- Issues a signed JWT containing person_id, pseudonymous_id, and role claims with 8-hour expiry.
- Returns 401 Unauthorized on invalid service number, incorrect password, or inactive account.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.jwt_auth import ACCESS_TOKEN_EXPIRE_HOURS, create_access_token
from app.models import Personnel
from app.schemas_auth import LoginRequest, LoginResponse
from app.security import verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user by service number and password.
    Returns a JWT access token with identity and role claims.
    """
    person = (
        db.query(Personnel)
        .filter(Personnel.service_number == credentials.service_number)
        .first()
    )

    if not person or not verify_password(credentials.password, person.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid service number or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not person.active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Resolve primary role (fallback to 'personnel' if no role assigned)
    role = person.roles[0].role if person.roles else "personnel"

    access_token = create_access_token(
        person_id=str(person.person_id),
        pseudonymous_id=str(person.pseudonymous_id),
        role=role,
    )

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        role=role,
        expires_in_hours=ACCESS_TOKEN_EXPIRE_HOURS,
    )
