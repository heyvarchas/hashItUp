import asyncio
import base64
import json
import os
import subprocess
import time
import httpx
import websockets

ARTIFACTS_DIR = "/home/ultron/.gemini/antigravity-ide/brain/47125cc2-430f-4cde-8fc5-6e99d376f180"

async def send_cmd(ws, msg_id, method, params=None):
    payload = {"id": msg_id, "method": method}
    if params:
        payload["params"] = params
    await ws.send(json.dumps(payload))
    while True:
        resp = await ws.recv()
        data = json.loads(resp)
        if data.get("id") == msg_id:
            return data.get("result", {})

async def capture_page(ws, msg_id, filename):
    # Capture full screenshot
    res = await send_cmd(ws, msg_id, "Page.captureScreenshot", {"format": "png"})
    data = base64.b64decode(res["data"])
    filepath = os.path.join(ARTIFACTS_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(data)
    print(f"[OK] Saved: {filename} ({len(data)} bytes)")

async def main():
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
            msg_id = 1
            await send_cmd(ws, msg_id, "Page.enable")
            msg_id += 1
            await send_cmd(ws, msg_id, "Runtime.enable")
            msg_id += 1
            await send_cmd(ws, msg_id, "Emulation.setDeviceMetricsOverride", {
                "width": 1440,
                "height": 900,
                "deviceScaleFactor": 1,
                "mobile": False
            })

            # 1. Login Page
            msg_id += 1
            await send_cmd(ws, msg_id, "Page.navigate", {"url": "http://localhost:5173/login"})
            await asyncio.sleep(2)
            msg_id += 1
            await capture_page(ws, msg_id, "01_login_console.png")

            # Login as Personnel (CAPF-2024-001)
            msg_id += 1
            await send_cmd(ws, msg_id, "Runtime.evaluate", {
                "expression": """
                (() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const pBtn = btns.find(b => b.textContent.includes('CAPF-2024-001'));
                    if (pBtn) pBtn.click();
                    setTimeout(() => {
                        const submit = document.querySelector('button[type="submit"]');
                        if (submit) submit.click();
                    }, 200);
                })()
                """
            })
            await asyncio.sleep(3)

            # 2. Personnel Dashboard
            msg_id += 1
            await capture_page(ws, msg_id, "02_personnel_dashboard.png")

            # 3. Wellness Check-in
            msg_id += 1
            await send_cmd(ws, msg_id, "Page.navigate", {"url": "http://localhost:5173/personnel/checkin"})
            await asyncio.sleep(2)
            msg_id += 1
            await capture_page(ws, msg_id, "03_wellness_checkin.png")

            # 4. Welfare Officer Login
            msg_id += 1
            await send_cmd(ws, msg_id, "Runtime.evaluate", {
                "expression": "sessionStorage.clear(); window.location.href = '/login';"
            })
            await asyncio.sleep(2)

            msg_id += 1
            await send_cmd(ws, msg_id, "Runtime.evaluate", {
                "expression": """
                (() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const wBtn = btns.find(b => b.textContent.includes('CAPF-2024-002'));
                    if (wBtn) wBtn.click();
                    setTimeout(() => {
                        const submit = document.querySelector('button[type="submit"]');
                        if (submit) submit.click();
                    }, 200);
                })()
                """
            })
            await asyncio.sleep(3)

            # 5. Welfare Dashboard
            msg_id += 1
            await capture_page(ws, msg_id, "04_welfare_dashboard.png")

            # 6. Alerts Queue
            msg_id += 1
            await send_cmd(ws, msg_id, "Page.navigate", {"url": "http://localhost:5173/welfare/alerts"})
            await asyncio.sleep(2)
            msg_id += 1
            await capture_page(ws, msg_id, "05_alerts_queue.png")

            # 7. Case Detail
            msg_id += 1
            await send_cmd(ws, msg_id, "Page.navigate", {"url": "http://localhost:5173/welfare/cases/CAPF-2024-001"})
            await asyncio.sleep(2)
            msg_id += 1
            await capture_page(ws, msg_id, "06_case_detail.png")

    finally:
        chrome_proc.terminate()
        print("[Complete] Finished capturing all views.")

if __name__ == "__main__":
    asyncio.run(main())
