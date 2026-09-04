import os
import subprocess
import time
import httpx

ARTIFACTS_DIR = "/home/ultron/.gemini/antigravity-ide/brain/47125cc2-430f-4cde-8fc5-6e99d376f180"

def get_tokens():
    with httpx.Client() as client:
        # Personnel
        p_res = client.post("http://localhost:8000/auth/login", json={
            "service_number": "CAPF-2024-001",
            "password": "password123"
        })
        p_token = p_res.json()["access_token"]

        # Welfare Officer
        w_res = client.post("http://localhost:8000/auth/login", json={
            "service_number": "CAPF-2024-002",
            "password": "password456"
        })
        w_token = w_res.json()["access_token"]

        return p_token, w_token

def capture(url, out_name):
    out_path = os.path.join(ARTIFACTS_DIR, out_name)
    cmd = [
        "/usr/bin/google-chrome",
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--window-size=1440,960",
        f"--screenshot={out_path}",
        "--virtual-time-budget=4000",
        url
    ]
    subprocess.run(cmd, check=True)
    if os.path.exists(out_path):
        print(f"[OK] Captured: {out_name} ({os.path.getsize(out_path)} bytes)")

def main():
    p_token, w_token = get_tokens()
    print("[Auth] Retrieved access tokens successfully.")

    # 1. Login Console
    capture("http://localhost:5173/login", "01_login_console.png")

    # 2. Personnel Dashboard
    capture(f"http://localhost:5173/personnel?auth_token={p_token}", "02_personnel_dashboard.png")

    # 3. Daily Wellness Check-in
    capture(f"http://localhost:5173/personnel/checkin?auth_token={p_token}", "03_wellness_checkin.png")

    # 4. Welfare Officer Dashboard
    capture(f"http://localhost:5173/welfare?auth_token={w_token}", "04_welfare_dashboard.png")

    # 5. Welfare Officer Alerts Queue
    capture(f"http://localhost:5173/welfare/alerts?auth_token={w_token}", "05_alerts_queue.png")

    # 6. Welfare Officer Case Detail
    capture(f"http://localhost:5173/welfare/cases/CAPF-2024-001?auth_token={w_token}", "06_case_detail.png")

    print("[Done] All views captured.")

if __name__ == "__main__":
    main()
