import asyncio
import base64
import json
import os
import subprocess
import time
import httpx
import websockets

ARTIFACTS_DIR = "/home/ultron/.gemini/antigravity-ide/brain/47125cc2-430f-4cde-8fc5-6e99d376f180"

async def get_tokens():
    async with httpx.AsyncClient() as client:
        # Personnel
        p_res = await client.post("http://localhost:8000/auth/login", json={
            "service_number": "CAPF-2024-001",
            "password": "password123"
        })
        p_token = p_res.json()["access_token"]

        # Welfare
        w_res = await client.post("http://localhost:8000/auth/login", json={
            "service_number": "CAPF-2024-002",
            "password": "password456"
        })
        w_token = w_res.json()["access_token"]

        return p_token, w_token

async def send_cdp_cmd(ws, req_id, method, params=None):
    payload = {"id": req_id, "method": method}
    if params:
        payload["params"] = params
    await ws.send(json.dumps(payload))
    while True:
        msg = await ws.recv()
        data = json.loads(msg)
        if data.get("id") == req_id:
            return data.get("result", {})

async def capture_route(ws, req_id_start, url, token, output_name, wait_sec=2.0):
    cur_id = req_id_start
    # Navigate to target
    cur_id += 1
    await send_cdp_cmd(ws, cur_id, "Page.navigate", {"url": url})
    await asyncio.sleep(0.5)

    if token:
        # Inject token
        cur_id += 1
        expr = f"sessionStorage.setItem('auth_token', '{token}'); window.location.reload();"
        await send_cdp_cmd(ws, cur_id, "Runtime.evaluate", {"expression": expr})
        await asyncio.sleep(wait_sec)
    else:
        await asyncio.sleep(wait_sec)

    # Capture screenshot
    cur_id += 1
    res = await send_cdp_cmd(ws, cur_id, "Page.captureScreenshot", {"format": "png", "captureBeyondViewport": True})
    raw = base64.b64decode(res["data"])
    out_path = os.path.join(ARTIFACTS_DIR, output_name)
    with open(out_path, "wb") as f:
        f.write(raw)
    print(f"[Captured] {output_name} ({len(raw)} bytes)")
    return cur_id

async def main():
    p_token, w_token = await get_tokens()
    print("[Auth] Acquired Personnel and Welfare Officer tokens.")

    chrome_proc = subprocess.Popen([
        "/usr/bin/google-chrome",
        "--headless=new",
        "--remote-debugging-port=9222",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--window-size=1440,900"
    ])
    time.sleep(2)

    try:
        async with httpx.AsyncClient() as client:
            res = await client.get("http://localhost:9222/json")
            pages = res.json()
            ws_url = pages[0]["webSocketDebuggerUrl"]

        async with websockets.connect(ws_url, max_size=50_000_000) as ws:
            req_id = 1
            await send_cdp_cmd(ws, req_id, "Page.enable")
            req_id += 1
            await send_cdp_cmd(ws, req_id, "Runtime.enable")
            req_id += 1
            await send_cdp_cmd(ws, req_id, "Emulation.setDeviceMetricsOverride", {
                "width": 1440,
                "height": 900,
                "deviceScaleFactor": 1,
                "mobile": False
            })

            # 1. Login Page (no token)
            req_id = await capture_route(ws, req_id, "http://localhost:5173/login", None, "01_login_console.png", 1.5)

            # 2. Personnel Dashboard
            req_id = await capture_route(ws, req_id, "http://localhost:5173/personnel", p_token, "02_personnel_dashboard.png", 2.5)

            # 3. Daily Wellness Check-in
            req_id = await capture_route(ws, req_id, "http://localhost:5173/personnel/checkin", p_token, "03_wellness_checkin.png", 2.0)

            # 4. Welfare Officer Dashboard
            req_id = await capture_route(ws, req_id, "http://localhost:5173/welfare", w_token, "04_welfare_dashboard.png", 2.5)

            # 5. Welfare Officer Alerts Queue
            req_id = await capture_route(ws, req_id, "http://localhost:5173/welfare/alerts", w_token, "05_alerts_queue.png", 2.0)

            # 6. Welfare Officer Case Detail
            req_id = await capture_route(ws, req_id, "http://localhost:5173/welfare/cases/CAPF-2024-001", w_token, "06_case_detail.png", 2.5)

    finally:
        chrome_proc.terminate()
        print("[Complete] All screenshots captured successfully.")

if __name__ == "__main__":
    asyncio.run(main())
