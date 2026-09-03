"""
Phase 3.4: Seed Loader.

Loads synthetic data into the PostgreSQL `identity` and `analytics` schemas,
establishing correct `pseudonymous_id` linkages across all tables.

Features:
- Batched high-performance database inserts using SQLAlchemy bulk operations.
- Full referential verification: ensures every analytics record's pseudonymous_id
  maps back to exactly one identity.personnel record.
- Operates both as a Python library, a CLI script, and backend handler for POST /hr/seed.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from sqlalchemy import func, text
from sqlalchemy.orm import Session

# Add backend directory to sys.path if running directly
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.db import SessionLocal, engine
from app.models import (
    Deployment,
    DutyRecord,
    LeaveRecord,
    Personnel,
    RiskScore,
    TrainingRecord,
    Transfer,
    Unit,
    UserRole,
    WellnessAssessment,
)
from app.risk import compute_risk
from app.synthetic.observed_features import ObservedFeatureGenerator
from app.synthetic.trajectory import LatentTrajectoryGenerator


def clear_existing_data(db: Session) -> None:
    """Safely clears existing synthetic records in correct dependency order."""
    db.execute(text("TRUNCATE TABLE analytics.interventions, analytics.alerts, analytics.recommendations, analytics.risk_scores CASCADE;"))
    db.execute(text("TRUNCATE TABLE analytics.wellness_assessments, analytics.training_records, analytics.transfers, analytics.deployments, analytics.leave_records, analytics.duty_records CASCADE;"))
    db.execute(text("TRUNCATE TABLE identity.user_roles, identity.personnel, identity.units CASCADE;"))
    db.commit()


def seed_database(
    db: Session,
    num_people: int = 500,
    months: int = 6,
    random_seed: int = 42,
    clear_existing: bool = False,
    batch_size: int = 5000,
) -> Dict[str, Any]:
    """
    Generates and loads synthetic population data into identity and analytics schemas.
    """
    start_time = time.time()
    num_days = months * 30

    if clear_existing:
        clear_existing_data(db)
        start_index = 1
    else:
        current_count = db.execute(text("SELECT count(*) FROM identity.personnel")).scalar() or 0
        max_sn = db.execute(
            text("SELECT service_number FROM identity.personnel WHERE service_number LIKE 'SN-1%' ORDER BY service_number DESC LIMIT 1")
        ).scalar()
        if max_sn and max_sn.startswith("SN-"):
            try:
                max_num = int(max_sn.replace("SN-", ""))
                start_index = max(max_num - 100000 + 1, current_count + 1)
            except ValueError:
                start_index = current_count + 1
        else:
            start_index = current_count + 1

    # 1. Simulate Trajectories
    traj_gen = LatentTrajectoryGenerator(num_days=num_days, random_seed=random_seed)
    trajectories = traj_gen.generate_population(num_people=num_people, start_index=start_index)

    # Query existing unit names and IDs from DB
    existing_unit_map = {
        name: str(uid)
        for (uid, name) in db.execute(text("SELECT unit_id, unit_name FROM identity.units")).fetchall()
    }

    # 2. Generate Relational Tables
    feature_gen = ObservedFeatureGenerator(random_seed=random_seed)
    tables = feature_gen.generate_all_tables(trajectories, existing_unit_map=existing_unit_map)

    counts: Dict[str, int] = {}

    # 3. Batch Insert into PostgreSQL

    # 3.1 Units (identity.units)
    units_to_insert = [
        {"unit_id": row["unit_id"], "unit_name": row["unit_name"]}
        for _, row in tables["units"].iterrows()
        if row["unit_name"] not in existing_unit_map
    ]
    if units_to_insert:
        db.bulk_insert_mappings(Unit, units_to_insert)
        db.flush()
        # update map with newly inserted units
        for u in units_to_insert:
            existing_unit_map[u["unit_name"]] = u["unit_id"]
    counts["units"] = len(tables["units"])

    # 3.2 Personnel (identity.personnel)
    personnel_records = tables["personnel"].to_dict(orient="records")
    for chunk in _chunk_list(personnel_records, batch_size):
        db.bulk_insert_mappings(Personnel, chunk)
        db.flush()
    counts["personnel"] = len(personnel_records)

    # 3.3 User Roles (identity.user_roles)
    roles_records = tables["user_roles"].to_dict(orient="records")
    for chunk in _chunk_list(roles_records, batch_size):
        db.bulk_insert_mappings(UserRole, chunk)
        db.flush()
    counts["user_roles"] = len(roles_records)

    # 3.4 Duty Records (analytics.duty_records)
    duty_records = tables["duty_records"].to_dict(orient="records")
    for chunk in _chunk_list(duty_records, batch_size):
        db.bulk_insert_mappings(DutyRecord, chunk)
        db.flush()
    counts["duty_records"] = len(duty_records)

    # 3.5 Leave Records (analytics.leave_records)
    leave_records = tables["leave_records"].to_dict(orient="records")
    if leave_records:
        for chunk in _chunk_list(leave_records, batch_size):
            db.bulk_insert_mappings(LeaveRecord, chunk)
            db.flush()
    counts["leave_records"] = len(leave_records)

    # 3.6 Deployments (analytics.deployments)
    deployments_records = tables["deployments"].to_dict(orient="records")
    if deployments_records:
        for chunk in _chunk_list(deployments_records, batch_size):
            db.bulk_insert_mappings(Deployment, chunk)
            db.flush()
    counts["deployments"] = len(deployments_records)

    # 3.7 Transfers (analytics.transfers)
    transfers_records = tables["transfers"].to_dict(orient="records")
    if transfers_records:
        for chunk in _chunk_list(transfers_records, batch_size):
            db.bulk_insert_mappings(Transfer, chunk)
            db.flush()
    counts["transfers"] = len(transfers_records)

    # 3.8 Training Records (analytics.training_records)
    training_records = tables["training_records"].to_dict(orient="records")
    if training_records:
        for chunk in _chunk_list(training_records, batch_size):
            db.bulk_insert_mappings(TrainingRecord, chunk)
            db.flush()
    counts["training_records"] = len(training_records)

    # 3.9 Wellness Assessments (analytics.wellness_assessments)
    wellness_records = tables["wellness_assessments"].to_dict(orient="records")
    if wellness_records:
        for chunk in _chunk_list(wellness_records, batch_size):
            db.bulk_insert_mappings(WellnessAssessment, chunk)
            db.flush()
    counts["wellness_assessments"] = len(wellness_records)

    db.commit()

    # 3.10 Synchronous Risk Scoring (analytics.risk_scores) — Phase 6.3
    # Trigger compute_risk for all seeded personnel post-ingestion
    seeded_pids = tables["personnel"]["pseudonymous_id"].tolist()
    for pid in seeded_pids:
        compute_risk(pid, db=db, save_to_db=True)
    counts["risk_scores"] = len(seeded_pids)

    elapsed = time.time() - start_time

    # 4. Referential Integrity Verification
    verification = verify_database_seeding(db)

    return {
        "status": "success",
        "num_people": num_people,
        "months": months,
        "elapsed_seconds": round(elapsed, 2),
        "inserted_counts": counts,
        "verification": verification,
    }


def verify_database_seeding(db: Session) -> Dict[str, Any]:
    """
    Verifies that all analytics records' pseudonymous_ids resolve back to
    exactly one identity.personnel row.
    """
    total_personnel = db.execute(text("SELECT count(*) FROM identity.personnel")).scalar()

    analytics_tables = [
        "duty_records",
        "leave_records",
        "deployments",
        "transfers",
        "training_records",
        "wellness_assessments",
        "risk_scores",
    ]

    table_stats = {}
    total_orphans = 0

    for tbl in analytics_tables:
        row_count = db.execute(text(f"SELECT count(*) FROM analytics.{tbl}")).scalar()

        # Check for unresolvable pseudonymous_ids (orphans)
        orphan_query = text(f"""
            SELECT count(DISTINCT a.pseudonymous_id)
            FROM analytics.{tbl} a
            LEFT JOIN identity.personnel p ON a.pseudonymous_id = p.pseudonymous_id
            WHERE p.pseudonymous_id IS NULL;
        """)
        orphan_count = db.execute(orphan_query).scalar()
        total_orphans += orphan_count

        table_stats[tbl] = {
            "total_rows": row_count,
            "unresolved_orphans": orphan_count,
        }

    is_valid = (total_personnel >= 500) and (total_orphans == 0)

    return {
        "total_personnel_in_db": total_personnel,
        "total_orphans_across_analytics": total_orphans,
        "table_stats": table_stats,
        "integrity_verified": is_valid,
    }


def _chunk_list(lst: list, chunk_size: int):
    for i in range(0, len(lst), chunk_size):
        yield lst[i : i + chunk_size]


def main():
    parser = argparse.ArgumentParser(description="Seed synthetic data into Postgres DB.")
    parser.add_argument("--people", type=int, default=500, help="Number of personnel (default: 500, target: 500-1000)")
    parser.add_argument("--months", type=int, default=6, help="Months of history (default: 6)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed (default: 42)")
    parser.add_argument("--clear", action="store_true", help="Clear existing DB data before seeding")

    args = parser.parse_args()

    print("=" * 75)
    print(" Task 3.4: Synthetic Data Seed Loader")
    print("=" * 75)
    print(f" Target Population : {args.people} personnel")
    print(f" History Horizon   : {args.months} months ({args.months * 30} days)")
    print(f" Clear Existing    : {args.clear}")
    print(f" Random Seed       : {args.seed}\n")

    db = SessionLocal()
    try:
        result = seed_database(
            db=db,
            num_people=args.people,
            months=args.months,
            random_seed=args.seed,
            clear_existing=args.clear,
        )

        print("Seeding completed successfully!")
        print(f"Elapsed Time: {result['elapsed_seconds']}s\n")
        print("Inserted Counts:")
        for tbl, cnt in result["inserted_counts"].items():
            print(f"  - {tbl:<24}: {cnt:>7} rows")

        print("\nReferential Integrity Verification:")
        ver = result["verification"]
        print(f"  - Total Personnel in DB      : {ver['total_personnel_in_db']}")
        print(f"  - Total Unresolved Orphans    : {ver['total_orphans_across_analytics']}")
        print(f"  - Integrity Verification     : {'PASSED [OK]' if ver['integrity_verified'] else 'FAILED'}")

        for tbl, stats in ver["table_stats"].items():
            print(f"    * analytics.{tbl:<20}: {stats['total_rows']:>7} rows (Orphans: {stats['unresolved_orphans']})")

        print("=" * 75)
    finally:
        db.close()


if __name__ == "__main__":
    main()
