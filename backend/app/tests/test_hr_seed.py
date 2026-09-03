"""
Integration and RBAC unit tests for Phase 3.4: Seed Loader & POST /hr/seed endpoint.
"""

import unittest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import SessionLocal
from app.jwt_auth import create_access_token
from app.main import app


class TestHRSeedEndpoint(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

        cls.admin_token = create_access_token(
            person_id=str(uuid.uuid4()),
            pseudonymous_id=str(uuid.uuid4()),
            role="admin",
        )
        cls.personnel_token = create_access_token(
            person_id=str(uuid.uuid4()),
            pseudonymous_id=str(uuid.uuid4()),
            role="personnel",
        )
        cls.welfare_token = create_access_token(
            person_id=str(uuid.uuid4()),
            pseudonymous_id=str(uuid.uuid4()),
            role="welfare_officer",
        )

    def test_unauthenticated_seed_rejected(self):
        resp = self.client.post("/hr/seed", json={"num_people": 5})
        self.assertEqual(resp.status_code, 403)

    def test_non_admin_roles_rejected(self):
        # Personnel role
        resp_p = self.client.post(
            "/hr/seed",
            json={"num_people": 5},
            headers={"Authorization": f"Bearer {self.personnel_token}"},
        )
        self.assertEqual(resp_p.status_code, 403)

        # Welfare officer role
        resp_w = self.client.post(
            "/hr/seed",
            json={"num_people": 5},
            headers={"Authorization": f"Bearer {self.welfare_token}"},
        )
        self.assertEqual(resp_w.status_code, 403)

    def test_admin_seed_endpoint_success(self):
        resp = self.client.post(
            "/hr/seed",
            json={"num_people": 10, "months": 2, "clear_existing": False, "random_seed": 101},
            headers={"Authorization": f"Bearer {self.admin_token}"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["num_people"], 10)
        self.assertIn("inserted_counts", data)
        self.assertIn("duty_records", data["inserted_counts"])
        self.assertTrue(data["verification"]["integrity_verified"])

    def test_database_pseudonymous_integrity(self):
        db = SessionLocal()
        try:
            # Verify that personnel records exist in database
            total_personnel = db.execute(text("SELECT count(*) FROM identity.personnel")).scalar()
            self.assertGreaterEqual(total_personnel, 1)

            # Check for any orphaned pseudonymous_id across all analytics tables
            analytics_tables = [
                "duty_records",
                "leave_records",
                "deployments",
                "transfers",
                "training_records",
                "wellness_assessments",
            ]

            for tbl in analytics_tables:
                orphan_query = text(f"""
                    SELECT count(DISTINCT a.pseudonymous_id)
                    FROM analytics.{tbl} a
                    LEFT JOIN identity.personnel p ON a.pseudonymous_id = p.pseudonymous_id
                    WHERE p.pseudonymous_id IS NULL;
                """)
                orphans = db.execute(orphan_query).scalar()
                self.assertEqual(orphans, 0, f"Found {orphans} orphaned records in analytics.{tbl}")
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
