"""
Verification script for Task 2.2 — JWT login endpoint.

Tests:
1. Valid login for test user 1 (personnel) -> 200 OK, valid JWT with person_id, pseudonymous_id, and role claims.
2. Valid login for test user 2 (welfare_officer) -> 200 OK, valid JWT with person_id, pseudonymous_id, and role claims.
3. Wrong password for test user 1 -> 401 Unauthorized.
4. Non-existent user -> 401 Unauthorized.
"""

import sys
from fastapi.testclient import TestClient

from app.jwt_auth import decode_access_token
from app.main import app

client = TestClient(app)


def test_jwt_login_flow():
    print("--- Running Task 2.2 Verification Tests ---")

    # 1. Test User 1 (Personnel)
    res1 = client.post(
        "/auth/login",
        json={"service_number": "CAPF-2024-001", "password": "password123"},
    )
    assert res1.status_code == 200, f"Expected 200, got {res1.status_code}: {res1.text}"
    data1 = res1.json()
    assert "access_token" in data1
    assert data1["token_type"] == "bearer"
    assert data1["role"] == "personnel"
    assert data1["expires_in_hours"] == 8

    # Verify JWT claims
    claims1 = decode_access_token(data1["access_token"])
    print("User 1 JWT claims decoded successfully:", claims1)
    assert "person_id" in claims1
    assert "pseudonymous_id" in claims1
    assert claims1["role"] == "personnel"
    assert claims1["sub"] == claims1["person_id"]
    print("✓ Test User 1 (personnel) login passed.")

    # 2. Test User 2 (Welfare Officer)
    res2 = client.post(
        "/auth/login",
        json={"service_number": "CAPF-2024-002", "password": "password456"},
    )
    assert res2.status_code == 200, f"Expected 200, got {res2.status_code}: {res2.text}"
    data2 = res2.json()
    assert "access_token" in data2
    assert data2["role"] == "welfare_officer"

    # Verify JWT claims
    claims2 = decode_access_token(data2["access_token"])
    print("User 2 JWT claims decoded successfully:", claims2)
    assert "person_id" in claims2
    assert "pseudonymous_id" in claims2
    assert claims2["role"] == "welfare_officer"
    print("✓ Test User 2 (welfare_officer) login passed.")

    # 3. Wrong password -> 401
    res_wrong = client.post(
        "/auth/login",
        json={"service_number": "CAPF-2024-001", "password": "wrongpassword!"},
    )
    assert res_wrong.status_code == 401, f"Expected 401, got {res_wrong.status_code}: {res_wrong.text}"
    print("✓ Wrong password rejected with 401 Unauthorized.")

    # 4. Non-existent user -> 401
    res_notfound = client.post(
        "/auth/login",
        json={"service_number": "NON-EXISTENT-999", "password": "password123"},
    )
    assert res_notfound.status_code == 401, f"Expected 401, got {res_notfound.status_code}: {res_notfound.text}"
    print("✓ Non-existent user rejected with 401 Unauthorized.")

    print("\nAll Task 2.2 verification checks passed successfully!")


if __name__ == "__main__":
    test_jwt_login_flow()
