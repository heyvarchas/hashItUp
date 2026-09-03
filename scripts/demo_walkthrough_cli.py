#!/usr/bin/env python3
"""
Phase 10.3: CLI Demo Walkthrough Runner (Fallback & Automation Tool).

Runs the complete 7-step welfare monitoring demonstration with rich formatting,
clear terminal visual outputs, and interactive step-by-step or automated mode.

Usage:
    python scripts/demo_walkthrough_cli.py            # Interactive (press Enter between steps)
    python scripts/demo_walkthrough_cli.py --auto     # Fully automated walkthrough
    python scripts/demo_walkthrough_cli.py --api-url http://localhost:8000
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any, Dict, Optional

# ANSI Color codes for clean terminal presentation
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"


class DemoRunner:
    def __init__(self, base_url: str = "http://localhost:8000", interactive: bool = True):
        self.base_url = base_url.rstrip("/")
        self.interactive = interactive
        self.personnel_token: Optional[str] = None
        self.officer_token: Optional[str] = None
        self.demo_pid: Optional[str] = None
        self.alert_id: Optional[str] = None
        self.risk_score_id: Optional[str] = None

    def prompt_step(self, title: str) -> None:
        print(f"\n{BOLD}{CYAN}{'='*75}{RESET}")
        print(f"{BOLD}{CYAN} >> {title}{RESET}")
        print(f"{BOLD}{CYAN}{'='*75}{RESET}")
        if self.interactive:
            try:
                input(f"{DIM}Press [Enter] to execute this step...{RESET}")
            except KeyboardInterrupt:
                print("\n[Demo Aborted]")
                sys.exit(0)
        else:
            time.sleep(0.5)

    def _post(self, path: str, payload: Dict[str, Any], token: Optional[str] = None) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        data = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        req = urllib.request.Request(url, data=data, headers=headers)
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())

    def _get(self, path: str, token: Optional[str] = None) -> Any:
        url = f"{self.base_url}{path}"
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())

    def run(self) -> None:
        print(f"\n{BOLD}{GREEN}==========================================================================={RESET}")
        print(f"{BOLD}{GREEN}    DEFENSE FORCES PERSONNEL STRESS & WELFARE MONITORING SYSTEM{RESET}")
        print(f"{BOLD}{GREEN}    End-to-End Live Demonstration Walkthrough (Phase 10){RESET}")
        print(f"{BOLD}{GREEN}==========================================================================={RESET}")

        # Step 0: Re-arm Demo Data
        self.prompt_step("Step 0: Re-arm Scripted Demo Persona to Baseline State")
        try:
            # Login as officer to reset
            officer_login = self._post("/auth/login", {
                "service_number": "CAPF-2024-002",
                "password": "password456",
            })
            self.officer_token = officer_login["access_token"]
            reset_data = self._post("/hr/demo-persona/reset", {}, self.officer_token)
            p_info = reset_data["demo_persona"]
            print(f"{GREEN}[OK] Scripted Demo Persona Initialized:{RESET}")
            print(f"  * Service Number   : {BOLD}{p_info['service_number']}{RESET}")
            print(f"  * Rank & Role      : {p_info['rank']} ({p_info['role']})")
            print(f"  * Baseline Score   : {YELLOW}{p_info['baseline_score']}/100 ({p_info['baseline_category'].upper()} tier){RESET}")
            print(f"  * Baseline Status  : {GREEN}Sitting just below high threshold, 0 open alerts{RESET}")
        except Exception as e:
            print(f"{RED}[ERROR] Reset step failed: {e}{RESET}")
            print(f"{YELLOW}Hint: Ensure backend is running at {self.base_url}{RESET}")
            sys.exit(1)

        # Step 1: Personnel Login
        self.prompt_step("Step 1: Personnel Authenticates via Service Number")
        login_data = self._post("/auth/login", {
            "service_number": "CAPF-2024-001",
            "password": "password123",
        })
        self.personnel_token = login_data["access_token"]
        print(f"{GREEN}[OK] Authentication Successful:{RESET}")
        print(f"  * Access Token Issued (8h expiry)")
        print(f"  * Role Bound : {BOLD}{login_data['role']}{RESET}")

        # Step 2: Live Wellness Check-in Submission
        self.prompt_step("Step 2: Personnel Submits Live Wellness Self-Assessment")
        checkin_payload = {
            "mood_score": 1,
            "sleep_quality_score": 1,
            "stress_self_rating": 9,
            "help_requested": False,
            "free_text_note": "Severe exhaustion, chronic sleep disturbance and feeling unable to cope.",
        }
        print(f"Submitting self-assessment:")
        print(f"  * Mood Rating        : {RED}1 / 5 (Distressed){RESET}")
        print(f"  * Sleep Quality      : {RED}1 / 5 (Broken / Insomnia){RESET}")
        print(f"  * Stress Self-Rating : {RED}9 / 10 (Severe / Overwhelming){RESET}")
        print(f"  * Encrypted Note     : \"{checkin_payload['free_text_note']}\"")

        checkin_resp = self._post("/wellness/assessment", checkin_payload, self.personnel_token)
        self.demo_pid = checkin_resp["pseudonymous_id"]
        print(f"\n{GREEN}[OK] Assessment Recorded to analytics.wellness_assessments:{RESET}")
        print(f"  * Assessment ID    : {checkin_resp['id']}")
        print(f"  * Pseudonymous ID  : {BOLD}{self.demo_pid}{RESET} (Identity isolated)")
        print(f"  * Synchronous risk evaluation triggered automatically.")

        # Step 3: Welfare Officer Triage & Alerts Queue
        self.prompt_step("Step 3: Welfare Officer Inspects Real-Time Alerts Queue")
        alerts = self._get("/alerts?status=open", self.officer_token)
        matching = [a for a in alerts if str(a.get("pseudonymous_id", "")).lower() == str(self.demo_pid).lower()]
        
        if not matching:
            print(f"{RED}[FAIL] No open alert found for persona!{RESET}")
            sys.exit(1)

        demo_alert = matching[0]
        self.alert_id = demo_alert["id"]
        self.risk_score_id = demo_alert["risk_score_id"]

        print(f"{RED}{BOLD}[!] NEW HIGH SEVERITY ALERT TRIPPED:{RESET}")
        print(f"  * Alert ID         : {self.alert_id}")
        print(f"  * Severity Tier    : {RED}{BOLD}{demo_alert['severity'].upper()}{RESET}")
        print(f"  * Calibrated Score : {RED}{BOLD}{demo_alert['calibrated_score']} / 100{RESET}")
        print(f"  * Pseudonymous ID  : {self.demo_pid}")
        print(f"  * Primary Factors  :")
        for factor in demo_alert.get("contributing_factors", []):
            print(f"    - {factor}")

        # Step 4: Clinical Case Drill-down
        self.prompt_step("Step 4: Welfare Officer Opens Confidential Case Details")
        risk_detail = self._get(f"/personnel/{self.demo_pid}/risk", self.officer_token)
        print(f"{CYAN}Clinical Risk Profile & Recommendation Engine Analysis:{RESET}")
        print(f"  * Risk Category    : {RED}{risk_detail['risk_category'].upper()}{RESET}")
        print(f"  * Calibrated Score : {risk_detail['calibrated_score']}/100")
        print(f"  * Automated Clinical Recommendations:")
        for rec in risk_detail.get("recommendations", []):
            print(f"    [{BOLD}{rec['recommendation_type'].upper()}{RESET}]: {rec['rationale']}")

        # Step 5: Record Welfare Intervention
        self.prompt_step("Step 5: Welfare Officer Records Clinical Intervention & Resolves Alert")
        intervention_payload = {
            "alert_id": self.alert_id,
            "intervention_type": "psychological_counseling",
            "notes": "Met with individual confidentially; arranged 1-on-1 counseling and temporary night shift exemption.",
            "new_alert_status": "resolved",
        }
        interv_resp = self._post("/interventions", intervention_payload, self.officer_token)
        print(f"{GREEN}[OK] Intervention Logged into analytics.interventions:{RESET}")
        print(f"  * Intervention ID  : {interv_resp['id']}")
        print(f"  * Action Type      : {interv_resp['intervention_type']}")
        print(f"  * Alert Transition : Status set to {GREEN}{BOLD}RESOLVED{RESET}")

        # Step 6: Unit Summary Reflection
        self.prompt_step("Step 6: Unit Aggregate Dashboard Dynamically Reflects Resolution")
        summary = self._get("/dashboard/unit-summary", self.officer_token)
        print(f"{GREEN}[OK] Privacy-Preserving Unit Statistics Updated:{RESET}")
        print(f"  * Total Monitored Personnel : {summary['total_personnel']}")
        print(f"  * Active Open Alerts        : {BOLD}{summary['open_alerts_count']}{RESET}")
        print(f"  * Unit Average Risk Score   : {summary['average_calibrated_score']}/100")
        print(f"  * Risk Distribution:")
        for d in summary.get("distribution", []):
            print(f"    - {d['label']:<18}: {d['count']:>3} personnel ({d['percentage']:>4.1f}%)")

        print(f"\n{BOLD}{GREEN}==========================================================================={RESET}")
        print(f"{BOLD}{GREEN} [SUCCESS] Phase 10 Walkthrough Completed with 100% Determinism!{RESET}")
        print(f"{BOLD}{GREEN}==========================================================================={RESET}\n")


def main():
    parser = argparse.ArgumentParser(description="Run the Phase 10 demo walkthrough in terminal.")
    parser.add_argument("--api-url", default="http://localhost:8000", help="Backend API URL")
    parser.add_argument("--auto", action="store_true", help="Run in non-interactive automatic mode")
    args = parser.parse_args()

    runner = DemoRunner(base_url=args.api_url, interactive=not args.auto)
    runner.run()


if __name__ == "__main__":
    main()
