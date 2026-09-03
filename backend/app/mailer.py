"""
Phase 7.3: Email Dispatcher Module for Welfare Alerts.

Provides `send_alert_email()` function using standard Python `smtplib` to send
formatted welfare alert emails to welfare officers or command staff.

Configurable via environment variables:
- `SMTP_HOST` (default: 'localhost')
- `SMTP_PORT` (default: 1025 for MailHog/dev SMTP, 587 for TLS)
- `SMTP_USER` (optional username)
- `SMTP_PASSWORD` (optional password)
- `SMTP_FROM` (default: 'alerts@welfare.mil')
- `SMTP_USE_TLS` (default: 'false')
- `ALERT_RECIPIENT_EMAIL` (default: 'welfare_officer@welfare.mil')
"""

from __future__ import annotations

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional, Union
import uuid


def send_alert_email(
    alert_id: Union[str, uuid.UUID],
    pseudonymous_id: Union[str, uuid.UUID],
    severity: str,
    calibrated_score: int,
    contributing_factors: Optional[List[str]] = None,
    recipient_email: Optional[str] = None,
    smtp_host: Optional[str] = None,
    smtp_port: Optional[int] = None,
) -> bool:
    """
    Sends an alert notification email using smtplib.

    Args:
        alert_id: UUID of the generated or updated alert.
        pseudonymous_id: Analytics pseudonym of the personnel.
        severity: 'high' or 'critical'.
        calibrated_score: Calibrated risk score (0-100).
        contributing_factors: List of top plain-language contributing factors.
        recipient_email: Destination email address.
        smtp_host: SMTP server hostname.
        smtp_port: SMTP server port.

    Returns:
        bool: True if email was successfully dispatched, False otherwise.
    """
    host = smtp_host or os.getenv("SMTP_HOST", "localhost")
    port = smtp_port or int(os.getenv("SMTP_PORT", "1025"))
    from_addr = os.getenv("SMTP_FROM", "alerts@welfare.mil")
    to_addr = recipient_email or os.getenv("ALERT_RECIPIENT_EMAIL", "welfare_officer@welfare.mil")
    username = os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASSWORD", "")
    use_tls = os.getenv("SMTP_USE_TLS", "false").lower() in ("1", "true", "yes")

    subject = f"[{severity.upper()} ALERT] Personnel Welfare Escalation - ID {str(pseudonymous_id)[:8]}"

    factors = contributing_factors or ["Severe risk threshold crossed."]
    factors_list_text = "\n".join([f"  - {f}" for f in factors])
    factors_list_html = "".join([f"<li>{f}</li>" for f in factors])

    body_text = f"""WELFARE ALERT NOTIFICATION
==========================
Severity        : {severity.upper()}
Pseudonymous ID : {pseudonymous_id}
Alert ID        : {alert_id}
Risk Score      : {calibrated_score}/100

Primary Contributing Factors:
{factors_list_text}

Action Required:
Review the welfare queue immediately via the Welfare Officer portal.
"""

    body_html = f"""<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
  <div style="background-color: {'#d9534f' if severity.lower() == 'critical' else '#f0ad4e'}; color: white; padding: 15px; border-radius: 4px;">
    <h2 style="margin: 0;">Welfare Alert Escalation: {severity.upper()}</h2>
  </div>
  <div style="padding: 15px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 4px 4px;">
    <p><strong>Pseudonymous ID:</strong> <code>{pseudonymous_id}</code></p>
    <p><strong>Alert ID:</strong> <code>{alert_id}</code></p>
    <p><strong>Calibrated Risk Score:</strong> <strong>{calibrated_score}/100</strong></p>
    
    <h3>Contributing Risk Factors</h3>
    <ul>
      {factors_list_html}
    </ul>
    
    <p style="margin-top: 20px; padding: 10px; background-color: #f8f9fa; border-left: 4px solid #0275d8;">
      <strong>Action Required:</strong> Please review this individual's welfare queue record and coordinate appropriate support or intervention.
    </p>
  </div>
</body>
</html>
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg.attach(MIMEText(body_text, "plain"))
    msg.attach(MIMEText(body_html, "html"))

    try:
        with smtplib.SMTP(host, port, timeout=5) as server:
            if use_tls:
                server.starttls()
            if username and password:
                server.login(username, password)
            server.sendmail(from_addr, [to_addr], msg.as_string())
        return True
    except Exception as e:
        # In testing/dev or if SMTP server is unavailable, log and return False gracefully
        print(f"[send_alert_email error] Failed to send email via {host}:{port}: {e}")
        return False
