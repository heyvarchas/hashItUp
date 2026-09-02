"""
Verification script for Task 2.3 — RBAC dependency + route protection.

Checks:
1. Personnel token -> GET /dummy/personnel-only: 200 OK.
2. Personnel token -> GET /dummy/welfare-officer-only: 403 Forbidden.
3. Welfare Officer token -> GET /dummy/welfare-officer-only: 200 OK.
4. Welfare Officer token -> GET /dummy/personnel-only: 403 Forbidden.
5. Both tokens -> GET /dummy/authenticated: 200 OK.
6. Missing token -> 401 Unauthorized / 403 depending on Bearer scheme.
7. Invalid token -> 401 Unauthorized.
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_rbac_flow():
    print("--- Running Task 2.3 RBAC Verification Tests ---")

    # 1. Login to get tokens for both roles
    res_p = client.post(
        "/auth/login",
        json={"service_number": "CAPF-2024-001", "password": "password123"},
    )
    assert res_p.status_code == 200, f"Personnel login failed: {res_p.text}"
    personnel_token = res_p.json()["access_token"]
    personnel_headers = {"Authorization": f"Bearer {personnel_token}"}

    res_w = client.post(
        "/auth/login",
        json={"service_number": "CAPF-2024-002", "password": "password456"},
    )
    assert res_w.status_code == 200, f"Welfare officer login failed: {res_w.text}"
    welfare_token = res_w.json()["access_token"]
    welfare_headers = {"Authorization": f"Bearer {welfare_token}"}

    # 2. Personnel token on personnel-only route -> 200
    res = client.get("/dummy/personnel-only", headers=personnel_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    print("✓ Personnel-role token -> GET /dummy/personnel-only: 200 OK")

    # 3. Personnel token on welfare-officer-only route -> 403
    res = client.get("/dummy/welfare-officer-only", headers=personnel_headers)
    assert res.status_code == 403, f"Expected 403, got {res.status_code}: {res.text}"
    print("✓ Personnel-role token -> GET /dummy/welfare-officer-only: 403 Forbidden")

    # 4. Welfare officer token on welfare-officer-only route -> 200
    res = client.get("/dummy/welfare-officer-only", headers=welfare_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    print("✓ Welfare-officer-role token -> GET /dummy/welfare-officer-only: 200 OK")

    # 5. Welfare officer token on personnel-only route -> 403
    res = client.get("/dummy/personnel-only", headers=welfare_headers)
    assert res.status_code == 403, f"Expected 403, got {res.status_code}: {res.text}"
    print("✓ Welfare-officer-role token -> GET /dummy/personnel-only: 403 Forbidden")

    # 6. Both roles on generic authenticated route -> 200
    res = client.get("/dummy/authenticated", headers=personnel_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    res = client.get("/dummy/authenticated", headers=welfare_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    print("✓ Both roles -> GET /dummy/authenticated: 200 OK")

    # 7. Invalid token -> 401
    bad_headers = {"Authorization": "Bearer invalid.token.value"}
    res = client.get("/dummy/personnel-only", headers=bad_headers)
    assert res.status_code == 401, f"Expected 401, got {res.status_code}: {res.text}"
    print("✓ Invalid token -> 401 Unauthorized")

    # 8. Missing token -> 401 / 403
    res = client.get("/dummy/personnel-only")
    assert res.status_code in (401, 403), f"Expected 401 or 403, got {res.status_code}"
    print(f"✓ Missing token rejected with {res.status_code}")

    print("\nAll Task 2.3 RBAC verification checks passed successfully!")


if __name__ == "__main__":
    test_rbac_flow()
