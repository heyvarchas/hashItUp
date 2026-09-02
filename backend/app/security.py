"""
Password hashing.

Argon2id via passlib — memory-hard, resistant to GPU/ASIC cracking,
the current recommended default for password storage (OWASP). No
plaintext or reversibly-encrypted password is ever stored; only the
Argon2 hash lives in identity.personnel.password_hash.

Kept as a tiny, dependency-isolated module on purpose: auth-related
routes (Task 2.2+) import hash_password/verify_password from here
rather than touching passlib directly, so the hashing scheme could be
swapped later (e.g. tuned memory/time cost for production hardware)
without touching any calling code.
"""

from passlib.context import CryptContext

# Single scheme, no legacy fallback needed for a system with no
# existing password data to migrate.
_pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """Hash a plaintext password for storage. Never store the return value's input."""
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check a plaintext password attempt against a stored Argon2 hash."""
    return _pwd_context.verify(plain_password, hashed_password)