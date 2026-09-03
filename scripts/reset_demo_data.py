#!/usr/bin/env python3
"""
Phase 10.3: Demo Data Reset & Re-arm Tool.

Quick-reset utility to restore the database and demo persona to pristine baseline
state in under 2 seconds. Can be executed locally, inside Docker, or in automated scripts.

Usage:
    python scripts/reset_demo_data.py               # Reset demo persona (CAPF-2024-001)
    python scripts/reset_demo_data.py --full-seed   # Truncate & re-seed full 500-person database
    python scripts/reset_demo_data.py --api-url http://localhost:8000  # Reset via REST API
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))


def reset_via_db(full_seed: bool = False, num_people: int = 500) -> None:
    """Resets directly via SQLAlchemy database connection."""
    from app.db import SessionLocal
    from app.synthetic.demo_persona import (
        DEMO_PERSONA_PASSWORD,
        DEMO_PERSONA_RANK,
        DEMO_PERSONA_ROLE,
        DEMO_PERSONA_SERVICE_NUMBER,
        DEMO_PERSONA_UNIT,
        seed_demo_persona,
    )
    from app.synthetic.seed_loader import seed_database

    db = SessionLocal()
    try:
        if full_seed:
            print(f"[Reset] Performing full re-seed ({num_people} synthetic personnel, 6 months history)...")
            res = seed_database(db=db, num_people=num_people, months=6, clear_existing=True)
            print(f"[Reset] Full seed completed in {res['elapsed_seconds']}s.")
            print(f"[Reset] Total Personnel in DB: {res['verification']['total_personnel_in_db']}")
        else:
            print("[Reset] Re-arming scripted demo persona to baseline state...")
            info = seed_demo_persona(db)
            print("\n[OK] Demo Persona Successfully Re-armed:")
            print(f"  - Service Number  : {info['service_number']}")
            print(f"  - Password        : {DEMO_PERSONA_PASSWORD}")
            print(f"  - Role            : {info['role']}")
            print(f"  - Rank            : {info['rank']}")
            print(f"  - Unit            : {DEMO_PERSONA_UNIT}")
            print(f"  - Baseline Score  : {info['baseline_score']}/100 ({info['baseline_category'].upper()} tier)")
            print(f"  - Open Alerts     : {info['baseline_open_alerts']} (Clean baseline)")
            print("\n[OK] Welfare Officer Account:")
            print("  - Service Number  : CAPF-2024-002")
            print("  - Password        : password456")
            print("  - Role            : welfare_officer")
            print("\n[OK] Ready for live demo walkthrough!")
    except Exception as e:
        print(f"[ERROR] Database reset failed: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


def reset_via_api(api_url: str) -> None:
    """Resets demo persona via backend REST API."""
    import urllib.error
    import urllib.request
    import json

    print(f"[Reset] Sending reset request to API at {api_url}...")

    # 1. Login as admin to get token
    login_url = f"{api_url.rstrip('/')}/auth/login"
    login_data = json.dumps({"service_number": "ADMIN-001", "password": "admin123"}).encode("utf-8")
    
    try:
        req = urllib.request.Request(login_url, data=login_data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req) as resp:
            token = json.loads(resp.read().decode())["access_token"]
    except Exception:
        # Fallback to officer login
        login_data = json.dumps({"service_number": "CAPF-2024-002", "password": "password456"}).encode("utf-8")
        req = urllib.request.Request(login_url, data=login_data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req) as resp:
            token = json.loads(resp.read().decode())["access_token"]

    # 2. Call reset endpoint
    reset_url = f"{api_url.rstrip('/')}/hr/demo-persona/reset"
    req = urllib.request.Request(reset_url, data=b"{}", headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    })
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print(f"[OK] {data['message']}")
        persona = data.get("demo_persona", {})
        print(f"  - Service Number : {persona.get('service_number')}")
        print(f"  - Baseline Score : {persona.get('baseline_score')} ({persona.get('baseline_category')})")
        print(f"  - Open Alerts    : {persona.get('baseline_open_alerts')}")


def main():
    parser = argparse.ArgumentParser(description="Reset demo persona or re-seed test database.")
    parser.add_argument("--full-seed", action="store_true", help="Truncate DB and seed full 500 population")
    parser.add_argument("--num-people", type=int, default=500, help="Population size for full seed (default: 500)")
    parser.add_argument("--api-url", type=str, default=None, help="Reset via API instead of direct DB connection (e.g. http://localhost:8000)")
    args = parser.parse_args()

    if args.api_url:
        reset_via_api(args.api_url)
    else:
        reset_via_db(full_seed=args.full_seed, num_people=args.num_people)


if __name__ == "__main__":
    main()
