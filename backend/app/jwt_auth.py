"""
JWT issuing and decoding.

Design decisions for the MVP (see Section 2.2 of the build checklist):
- One token only (access token), 8-hour expiry — no refresh-token
  rotation. Simpler to build and test; re-login after 8 hours is a
  perfectly reasonable tradeoff for a prototype, and the full design
  (short-lived access + rotating refresh) is documented as the
  production upgrade path, not silently forgotten.
- HS256 (symmetric signing) rather than RS256 for the MVP — one shared
  secret is enough when there's a single backend process verifying its
  own tokens. RS256 (asymmetric) matters once multiple independent
  services need to verify tokens without holding the signing key —
  that's a production/microservices concern, not this one.
- Claims embedded in the token: person_id, pseudonymous_id, role.
  The pseudonymous_id claim is what lets Task 4.1's wellness-submission
  endpoint take the caller's identity from the token instead of trusting
  a client-supplied value in the request body.
"""

import os
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

# In production this MUST come from a real secret store (Vault/KMS), never
# a hardcoded default. The fallback below exists only so local/dev runs
# don't crash if JWT_SECRET_KEY isn't set yet — it is deliberately obvious
# and unusable as a real secret.
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "INSECURE_DEV_ONLY_CHANGE_ME")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 8

http_bearer = HTTPBearer(auto_error=True)


def create_access_token(person_id: str, pseudonymous_id: str, role: str) -> str:
    """Issue a signed JWT containing the caller's identity claims and role."""
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": str(person_id),
        "person_id": str(person_id),
        "pseudonymous_id": str(pseudonymous_id),
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Decode and verify a JWT. Raises jose.JWTError (via re-raise) if the
    signature is invalid or the token has expired — callers (the auth
    dependency in Task 2.3) are expected to catch this and turn it into
    a 401 response, not to let it bubble up as a 500.
    """
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise


def get_current_user_claims(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
) -> dict:
    """
    Extract and decode JWT from Authorization: Bearer <token> header.
    Returns claims dict if valid; raises 401 if missing, invalid, or expired.
    """
    try:
        payload = decode_access_token(credentials.credentials)
        if "role" not in payload or ("person_id" not in payload and "sub" not in payload):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload: missing required claims",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_roles(allowed_roles: list[str] | tuple[str, ...]):
    """
    FastAPI dependency factory for Role-Based Access Control (RBAC).
    Checks whether the role claim in the JWT is in allowed_roles.
    Returns claims if allowed, raises 403 Forbidden otherwise.
    """
    allowed = set(allowed_roles)

    def role_checker(claims: dict = Depends(get_current_user_claims)) -> dict:
        user_role = claims.get("role")
        if user_role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted: role '{user_role}' does not have access",
            )
        return claims

    return role_checker