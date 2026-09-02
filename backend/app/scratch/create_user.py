"""
Create a personnel account + assign a role.

Task 2.1 scope: a CLI script is enough here — a real admin-facing
"create user" API endpoint is Phase 9/RBAC territory, not this task.
This exists purely so we (and Task 2.2/2.3) have real hashed-password
test users to log in as.

Usage (inside the backend container or locally with DATABASE_URL set):

    python -m app.scratch.create_user \
        --service-number CAPF-2024-001 \
        --password "somepassword123" \
        --role welfare_officer \
        --rank "Inspector" \
        --unit "Test Battalion"

Role must be one of: personnel, welfare_officer, admin
(matches the CHECK constraint on identity.user_roles.role).

Running it twice with the same --service-number is safe: it will
skip creating a duplicate personnel row and just report that the
account already exists, rather than erroring out or creating a
second row with a UNIQUE constraint violation.
"""

import argparse
import sys

from app.db import SessionLocal
from app.models import Personnel, Unit, UserRole
from app.security import hash_password

VALID_ROLES = {"personnel", "welfare_officer", "admin"}


def get_or_create_unit(db, unit_name: str) -> Unit:
    unit = db.query(Unit).filter(Unit.unit_name == unit_name).first()
    if unit:
        return unit
    unit = Unit(unit_name=unit_name)
    db.add(unit)
    db.flush()
    return unit


def create_user(service_number: str, password: str, role: str, rank: str | None, unit_name: str | None) -> None:
    if role not in VALID_ROLES:
        print(f"Invalid role '{role}'. Must be one of: {', '.join(sorted(VALID_ROLES))}")
        sys.exit(1)

    db = SessionLocal()
    try:
        existing = db.query(Personnel).filter(Personnel.service_number == service_number).first()
        if existing:
            print(f"Personnel with service_number={service_number} already exists (person_id={existing.person_id}). Skipping creation.")
            return

        unit = get_or_create_unit(db, unit_name) if unit_name else None

        person = Personnel(
            service_number=service_number,
            password_hash=hash_password(password),
            rank=rank,
            unit_id=unit.unit_id if unit else None,
        )
        db.add(person)
        db.flush()

        user_role = UserRole(person_id=person.person_id, role=role)
        db.add(user_role)

        db.commit()

        print("Created personnel account:")
        print(f"  service_number   = {person.service_number}")
        print(f"  person_id        = {person.person_id}")
        print(f"  pseudonymous_id  = {person.pseudonymous_id}")
        print(f"  role             = {role}")
        print(f"  password_hash    = {person.password_hash[:30]}... (Argon2, not plaintext)")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a personnel test user with a hashed password.")
    parser.add_argument("--service-number", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--role", required=True, choices=sorted(VALID_ROLES))
    parser.add_argument("--rank", default=None)
    parser.add_argument("--unit", default=None, help="Unit name; created if it doesn't exist yet.")
    args = parser.parse_args()

    create_user(args.service_number, args.password, args.role, args.rank, args.unit)


if __name__ == "__main__":
    main()