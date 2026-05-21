import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import resend

from app.config import settings

logger = logging.getLogger(__name__)

FROM_NO_REPLY = "no-reply@trakvora.com"
FROM_SUPPORT = "support@trakvora.com"


def _get_from_email() -> str:
    return settings.smtp_from_email or settings.smtp_username or FROM_NO_REPLY


def _send_via_resend(to: str, subject: str, html: str, from_email: str) -> None:
    resend.api_key = settings.resend_api_key
    resend.Emails.send({
        "from": f"trakvora <{from_email}>",
        "to": [to],
        "subject": subject,
        "html": html,
    })


def _send_via_smtp(to: str, subject: str, html: str, from_email: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to
    msg.attach(MIMEText(html, "html"))
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as server:
        if settings.smtp_tls:
            server.starttls()
        if settings.smtp_username:
            server.login(settings.smtp_username, settings.smtp_password)
        server.sendmail(settings.smtp_username or from_email, [to], msg.as_string())


def _send_email(to: str, subject: str, html: str, from_email: str) -> None:
    if settings.resend_api_key:
        _send_via_resend(to, subject, html, from_email)
    elif settings.smtp_username and settings.smtp_host:
        _send_via_smtp(to, subject, html, from_email)
    else:
        raise RuntimeError("No email transport configured (set RESEND_API_KEY or SMTP credentials)")


def _otp_html(name: str, code: str, purpose: str = "sign in") -> str:
    return f"""
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8f9fa;border-radius:12px;">
      <h2 style="color:#041627;font-size:24px;margin-bottom:8px;">Your trakvora code</h2>
      <p style="color:#555;margin-bottom:24px;">Hi {name}, use this code to {purpose}:</p>
      <div style="background:#041627;color:#fe6a34;font-size:36px;font-weight:700;letter-spacing:12px;
                  text-align:center;padding:20px;border-radius:8px;margin-bottom:24px;">
        {code}
      </div>
      <p style="color:#888;font-size:13px;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
      <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;"/>
      <p style="color:#aaa;font-size:12px;">trakvora — East Africa Freight Exchange</p>
    </div>
    """


async def send_otp_email(to: str, code: str, name: str = "there", purpose: str = "sign in") -> None:
    logger.info(f"[OTP] {to} → {code}")

    if not settings.resend_api_key and (not settings.smtp_username or not settings.smtp_host):
        logger.warning("No email transport configured; skipping OTP email delivery.")
        return

    try:
        html = _otp_html(name, code, purpose)
        await asyncio.to_thread(
            _send_email, to, "trakvora — Your verification code", html, _get_from_email()
        )
        logger.info(f"Sent OTP email to {to}")
    except Exception as exc:
        logger.error(f"Failed to send OTP email to {to}: {exc}")


def _welcome_html(name: str, role: str) -> str:
    role_lines = {
        "shipper": ("Post your first load", "Connect with vetted carriers across East Africa and move cargo with confidence."),
        "owner": ("Add your fleet", "List your trucks and start accepting loads from verified shippers."),
        "driver": ("Browse available loads", "Find loads near you and start earning on your own schedule."),
        "admin": ("Admin access granted", "Your trakvora admin account is ready."),
    }
    cta_label, tagline = role_lines.get(role, ("Get started", "Your trakvora account is ready."))

    return f"""
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#f8f9fa;border-radius:12px;">
      <h1 style="color:#041627;font-size:26px;margin-bottom:4px;">Welcome to trakvora, {name}.</h1>
      <p style="color:#555;font-size:15px;margin-bottom:32px;">{tagline}</p>
      <div style="background:#041627;border-radius:8px;padding:24px 28px;margin-bottom:28px;">
        <p style="color:#fe6a34;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px;">
          Next step
        </p>
        <p style="color:#fff;font-size:17px;font-weight:600;margin:0;">{cta_label}</p>
      </div>
      <p style="color:#888;font-size:13px;">
        Questions? Reply to this email or write to
        <a href="mailto:support@trakvora.com" style="color:#fe6a34;">support@trakvora.com</a>.
      </p>
      <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;"/>
      <p style="color:#aaa;font-size:12px;">trakvora — East Africa Freight Exchange</p>
    </div>
    """


async def send_welcome_email(to: str, name: str, role: str) -> None:
    logger.info(f"[Welcome] {to} role={role}")

    if not settings.resend_api_key and (not settings.smtp_username or not settings.smtp_host):
        logger.warning("No email transport configured; skipping welcome email delivery.")
        return

    try:
        html = _welcome_html(name, role)
        await asyncio.to_thread(
            _send_email, to, f"Welcome to trakvora, {name.split()[0]}!", html, _get_from_email()
        )
        logger.info(f"Sent welcome email to {to}")
    except Exception as exc:
        logger.error(f"Failed to send welcome email to {to}: {exc}")


def _admin_credentials_html(name: str, role_label: str, temp_password: str) -> str:
    return f"""
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#f8f9fa;border-radius:12px;">
      <h1 style="color:#041627;font-size:24px;margin-bottom:4px;">You've been added to trakvora as {role_label}</h1>
      <p style="color:#555;font-size:15px;margin-bottom:28px;">Hi {name}, a super admin has created your admin account. Use the credentials below to sign in for the first time.</p>
      <div style="background:#041627;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
        <p style="color:#fe6a34;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin:0 0 6px;">Temporary Password</p>
        <p style="color:#fff;font-size:22px;font-weight:700;letter-spacing:4px;margin:0;">{temp_password}</p>
      </div>
      <p style="color:#888;font-size:13px;">Please change this password immediately after your first login.</p>
      <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;"/>
      <p style="color:#aaa;font-size:12px;">trakvora — East Africa Freight Exchange</p>
    </div>
    """


async def send_admin_credentials_email(to: str, name: str, role_label: str, temp_password: str) -> None:
    logger.info(f"[AdminCredentials] {to} role={role_label}")
    if not settings.resend_api_key and (not settings.smtp_username or not settings.smtp_host):
        logger.warning("No email transport configured; skipping admin credentials email.")
        return
    try:
        html = _admin_credentials_html(name, role_label, temp_password)
        await asyncio.to_thread(
            _send_email, to, f"Your trakvora admin account — {role_label}", html, _get_from_email()
        )
        logger.info(f"Sent admin credentials email to {to}")
    except Exception as exc:
        logger.error(f"Failed to send admin credentials email to {to}: {exc}")


def _admin_appointment_html(name: str, role_label: str) -> str:
    return f"""
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#f8f9fa;border-radius:12px;">
      <h1 style="color:#041627;font-size:24px;margin-bottom:4px;">You've been appointed as {role_label}</h1>
      <p style="color:#555;font-size:15px;margin-bottom:28px;">Hi {name}, a super admin has granted you admin access on trakvora. Your existing password remains unchanged — log in to access the admin console.</p>
      <div style="background:#041627;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
        <p style="color:#fe6a34;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin:0 0 6px;">Your Role</p>
        <p style="color:#fff;font-size:18px;font-weight:700;margin:0;">{role_label}</p>
      </div>
      <p style="color:#888;font-size:13px;">Questions? Contact <a href="mailto:support@trakvora.com" style="color:#fe6a34;">support@trakvora.com</a>.</p>
      <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;"/>
      <p style="color:#aaa;font-size:12px;">trakvora — East Africa Freight Exchange</p>
    </div>
    """


async def send_admin_appointment_email(to: str, name: str, role_label: str) -> None:
    logger.info(f"[AdminAppointment] {to} role={role_label}")
    if not settings.resend_api_key and (not settings.smtp_username or not settings.smtp_host):
        logger.warning("No email transport configured; skipping admin appointment email.")
        return
    try:
        html = _admin_appointment_html(name, role_label)
        await asyncio.to_thread(
            _send_email, to, f"Admin access granted — trakvora {role_label}", html, _get_from_email()
        )
        logger.info(f"Sent admin appointment email to {to}")
    except Exception as exc:
        logger.error(f"Failed to send admin appointment email to {to}: {exc}")


def _support_ticket_html(
    user_name: str, user_email: str, user_role: str, user_phone: str | None,
    ticket_type: str, subject: str, load_ref: str | None, message: str,
) -> str:
    load_row = f"<tr><td style='color:#fe6a34;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:0 0 4px;'>Load Ref</td><td style='color:#fff;font-size:14px;padding:0 0 12px;'>{load_ref}</td></tr>" if load_ref else ""
    phone_row = f"<tr><td style='color:#fe6a34;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:0 0 4px;'>Phone</td><td style='color:#fff;font-size:14px;padding:0 0 12px;'>{user_phone}</td></tr>" if user_phone else ""
    return f"""
    <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:40px 32px;background:#f8f9fa;border-radius:12px;">
      <h2 style="color:#041627;font-size:22px;margin-bottom:4px;">New Support Ticket</h2>
      <p style="color:#555;font-size:14px;margin-bottom:28px;">A user has submitted a support request.</p>
      <div style="background:#041627;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:#fe6a34;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:0 0 4px;">From</td><td style="color:#fff;font-size:14px;padding:0 0 12px;">{user_name} &lt;{user_email}&gt;</td></tr>
          <tr><td style="color:#fe6a34;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:0 0 4px;">Role</td><td style="color:#fff;font-size:14px;padding:0 0 12px;text-transform:capitalize;">{user_role}</td></tr>
          {phone_row}
          <tr><td style="color:#fe6a34;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:0 0 4px;">Type</td><td style="color:#fff;font-size:14px;padding:0 0 12px;">{ticket_type}</td></tr>
          <tr><td style="color:#fe6a34;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:0 0 4px;">Subject</td><td style="color:#fff;font-size:16px;font-weight:600;padding:0 0 12px;">{subject}</td></tr>
          {load_row}
        </table>
      </div>
      <div style="background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
        <p style="color:#fe6a34;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px;">Message</p>
        <p style="color:#333;font-size:14px;line-height:1.7;white-space:pre-wrap;margin:0;">{message}</p>
      </div>
      <p style="color:#888;font-size:13px;">Reply directly to this email to respond to {user_name}.</p>
      <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;"/>
      <p style="color:#aaa;font-size:12px;">trakvora — East Africa Freight Exchange</p>
    </div>
    """


async def send_support_ticket_email(
    user_name: str,
    user_email: str,
    user_role: str,
    user_phone: str | None,
    ticket_type: str,
    subject: str,
    load_ref: str | None,
    message: str,
    support_email: str = "support@trakvora.com",
) -> None:
    logger.info(f"[SupportTicket] from={user_email} type={ticket_type}")
    if not settings.resend_api_key and (not settings.smtp_username or not settings.smtp_host):
        logger.warning("No email transport configured; skipping support ticket email.")
        return
    try:
        html = _support_ticket_html(user_name, user_email, user_role, user_phone, ticket_type, subject, load_ref, message)
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[Support] {subject}"
        msg["From"] = _get_from_email()
        msg["To"] = support_email
        msg["Reply-To"] = user_email
        msg.attach(MIMEText(html, "html"))
        if settings.resend_api_key:
            await asyncio.to_thread(
                _send_email, support_email, f"[Support] {subject}", html, _get_from_email()
            )
        else:
            await asyncio.to_thread(_send_via_smtp_msg, msg)
        logger.info(f"Sent support ticket email to {support_email}")
    except Exception as exc:
        logger.error(f"Failed to send support ticket email: {exc}")


def _send_via_smtp_msg(msg: MIMEMultipart) -> None:
    """Send a pre-built MIMEMultipart (preserves Reply-To header)."""
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as server:
        if settings.smtp_tls:
            server.starttls()
        if settings.smtp_username:
            server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(msg)


def _bid_received_html(shipper_name: str, bidder_name: str, route: str, amount_kes: float) -> str:
    return f"""
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#f8f9fa;border-radius:12px;">
      <h2 style="color:#041627;font-size:22px;margin-bottom:4px;">New bid on your load</h2>
      <p style="color:#555;font-size:15px;margin-bottom:28px;">Hi {shipper_name}, you received a new bid from <strong>{bidder_name}</strong>.</p>
      <div style="background:#041627;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
        <p style="color:#fe6a34;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin:0 0 6px;">Route</p>
        <p style="color:#fff;font-size:16px;font-weight:600;margin:0 0 14px;">{route}</p>
        <p style="color:#fe6a34;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin:0 0 6px;">Bid Amount</p>
        <p style="color:#fff;font-size:22px;font-weight:700;margin:0;">KES {amount_kes:,.0f}</p>
      </div>
      <p style="color:#555;font-size:14px;">Log in to trakvora to compare bids and accept the best offer.</p>
      <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;"/>
      <p style="color:#aaa;font-size:12px;">trakvora — East Africa Freight Exchange</p>
    </div>
    """


async def send_bid_received_email(
    to: str, shipper_name: str, bidder_name: str, route: str, amount_kes: float
) -> None:
    logger.info(f"[BidReceived] {to}")
    if not settings.resend_api_key and (not settings.smtp_username or not settings.smtp_host):
        logger.warning("No email transport configured; skipping bid-received email.")
        return
    try:
        html = _bid_received_html(shipper_name, bidder_name, route, amount_kes)
        await asyncio.to_thread(
            _send_email, to, f"New bid on your load: {route}", html, _get_from_email()
        )
        logger.info(f"Sent bid-received email to {to}")
    except Exception as exc:
        logger.error(f"Failed to send bid-received email to {to}: {exc}")


def _bid_accepted_html(owner_name: str, route: str, amount_kes: float) -> str:
    return f"""
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#f8f9fa;border-radius:12px;">
      <h2 style="color:#041627;font-size:22px;margin-bottom:4px;">Your bid was accepted!</h2>
      <p style="color:#555;font-size:15px;margin-bottom:28px;">Hi {owner_name}, congratulations — the shipper has accepted your bid.</p>
      <div style="background:#041627;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
        <p style="color:#fe6a34;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin:0 0 6px;">Route</p>
        <p style="color:#fff;font-size:16px;font-weight:600;margin:0 0 14px;">{route}</p>
        <p style="color:#fe6a34;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin:0 0 6px;">Accepted Amount</p>
        <p style="color:#fff;font-size:22px;font-weight:700;margin:0;">KES {amount_kes:,.0f}</p>
      </div>
      <p style="color:#555;font-size:14px;">A shipment has been created and funds placed in escrow. Log in to trakvora to view your active shipment.</p>
      <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;"/>
      <p style="color:#aaa;font-size:12px;">trakvora — East Africa Freight Exchange</p>
    </div>
    """


async def send_bid_accepted_email(to: str, owner_name: str, route: str, amount_kes: float) -> None:
    logger.info(f"[BidAccepted] {to}")
    if not settings.resend_api_key and (not settings.smtp_username or not settings.smtp_host):
        logger.warning("No email transport configured; skipping bid-accepted email.")
        return
    try:
        html = _bid_accepted_html(owner_name, route, amount_kes)
        await asyncio.to_thread(
            _send_email, to, "Your bid was accepted — trakvora", html, _get_from_email()
        )
        logger.info(f"Sent bid-accepted email to {to}")
    except Exception as exc:
        logger.error(f"Failed to send bid-accepted email to {to}: {exc}")


def _bid_rejected_html(owner_name: str, route: str) -> str:
    return f"""
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#f8f9fa;border-radius:12px;">
      <h2 style="color:#041627;font-size:22px;margin-bottom:4px;">Bid not selected</h2>
      <p style="color:#555;font-size:15px;margin-bottom:28px;">Hi {owner_name}, thank you for your bid. The shipper has selected another carrier for this shipment.</p>
      <div style="background:#041627;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
        <p style="color:#fe6a34;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin:0 0 6px;">Route</p>
        <p style="color:#fff;font-size:16px;font-weight:600;margin:0;">{route}</p>
      </div>
      <p style="color:#555;font-size:14px;">Keep browsing the marketplace — new loads are posted daily.</p>
      <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;"/>
      <p style="color:#aaa;font-size:12px;">trakvora — East Africa Freight Exchange</p>
    </div>
    """


async def send_bid_rejected_email(to: str, owner_name: str, route: str) -> None:
    logger.info(f"[BidRejected] {to}")
    if not settings.resend_api_key and (not settings.smtp_username or not settings.smtp_host):
        logger.warning("No email transport configured; skipping bid-rejected email.")
        return
    try:
        html = _bid_rejected_html(owner_name, route)
        await asyncio.to_thread(
            _send_email, to, "Bid update from trakvora", html, _get_from_email()
        )
        logger.info(f"Sent bid-rejected email to {to}")
    except Exception as exc:
        logger.error(f"Failed to send bid-rejected email to {to}: {exc}")


def _shipment_in_transit_html(shipper_name: str, route: str) -> str:
    return f"""
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#f8f9fa;border-radius:12px;">
      <h2 style="color:#041627;font-size:22px;margin-bottom:4px;">Your load is on the way</h2>
      <p style="color:#555;font-size:15px;margin-bottom:28px;">Hi {shipper_name}, your cargo is now in transit.</p>
      <div style="background:#041627;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
        <p style="color:#fe6a34;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin:0 0 6px;">Route</p>
        <p style="color:#fff;font-size:16px;font-weight:600;margin:0;">{route}</p>
      </div>
      <p style="color:#555;font-size:14px;">Log in to trakvora to track your shipment in real time.</p>
      <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;"/>
      <p style="color:#aaa;font-size:12px;">trakvora — East Africa Freight Exchange</p>
    </div>
    """


async def send_shipment_in_transit_email(to: str, shipper_name: str, route: str) -> None:
    logger.info(f"[InTransit] {to}")
    if not settings.resend_api_key and (not settings.smtp_username or not settings.smtp_host):
        logger.warning("No email transport configured; skipping in-transit email.")
        return
    try:
        html = _shipment_in_transit_html(shipper_name, route)
        await asyncio.to_thread(
            _send_email, to, f"Your load is in transit — {route}", html, _get_from_email()
        )
        logger.info(f"Sent in-transit email to {to}")
    except Exception as exc:
        logger.error(f"Failed to send in-transit email to {to}: {exc}")


def _shipment_delivered_html(shipper_name: str, route: str, amount_kes: float) -> str:
    return f"""
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#f8f9fa;border-radius:12px;">
      <h2 style="color:#041627;font-size:22px;margin-bottom:4px;">Your load has been delivered</h2>
      <p style="color:#555;font-size:15px;margin-bottom:28px;">Hi {shipper_name}, your cargo has arrived safely.</p>
      <div style="background:#041627;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
        <p style="color:#fe6a34;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin:0 0 6px;">Route</p>
        <p style="color:#fff;font-size:16px;font-weight:600;margin:0 0 14px;">{route}</p>
        <p style="color:#fe6a34;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin:0 0 6px;">Amount</p>
        <p style="color:#fff;font-size:22px;font-weight:700;margin:0;">KES {amount_kes:,.0f}</p>
      </div>
      <p style="color:#555;font-size:14px;">Payment will be released to the carrier shortly. Log in to confirm delivery and rate your carrier.</p>
      <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;"/>
      <p style="color:#aaa;font-size:12px;">trakvora — East Africa Freight Exchange</p>
    </div>
    """


async def send_shipment_delivered_email(to: str, shipper_name: str, route: str, amount_kes: float) -> None:
    logger.info(f"[Delivered] {to}")
    if not settings.resend_api_key and (not settings.smtp_username or not settings.smtp_host):
        logger.warning("No email transport configured; skipping delivered email.")
        return
    try:
        html = _shipment_delivered_html(shipper_name, route, amount_kes)
        await asyncio.to_thread(
            _send_email, to, "Load delivered — trakvora", html, _get_from_email()
        )
        logger.info(f"Sent delivered email to {to}")
    except Exception as exc:
        logger.error(f"Failed to send delivered email to {to}: {exc}")


def _subscription_past_due_html(owner_name: str, plan_name: str, amount_kes: float) -> str:
    return f"""
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#f8f9fa;border-radius:12px;">
      <h2 style="color:#041627;font-size:22px;margin-bottom:4px;">Subscription renewal failed</h2>
      <p style="color:#555;font-size:15px;margin-bottom:28px;">Hi {owner_name}, we couldn't renew your <strong>{plan_name}</strong> subscription due to insufficient wallet balance.</p>
      <div style="background:#041627;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
        <p style="color:#fe6a34;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin:0 0 6px;">Amount Due</p>
        <p style="color:#fff;font-size:22px;font-weight:700;margin:0;">KES {amount_kes:,.0f}</p>
      </div>
      <p style="color:#555;font-size:14px;">Top up your trakvora wallet and resubscribe to restore full access. Your data is safe.</p>
      <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;"/>
      <p style="color:#aaa;font-size:12px;">trakvora — East Africa Freight Exchange</p>
    </div>
    """


async def send_subscription_past_due_email(to: str, owner_name: str, plan_name: str, amount_kes: float) -> None:
    logger.info(f"[SubPastDue] {to}")
    if not settings.resend_api_key and (not settings.smtp_username or not settings.smtp_host):
        logger.warning("No email transport configured; skipping past-due email.")
        return
    try:
        html = _subscription_past_due_html(owner_name, plan_name, amount_kes)
        await asyncio.to_thread(
            _send_email, to, "Action required: subscription renewal failed — trakvora", html, _get_from_email()
        )
        logger.info(f"Sent past-due email to {to}")
    except Exception as exc:
        logger.error(f"Failed to send past-due email to {to}: {exc}")


# ── Demo request emails ────────────────────────────────────────────────────────

def _demo_internal_html(lead: dict) -> str:
    features = ", ".join(lead.get("features", [])) or "—"
    notes    = lead.get("notes") or "—"
    rows = [
        ("Name",           lead.get("name",           "—")),
        ("Email",          lead.get("email",          "—")),
        ("Phone",          lead.get("phone",          "—")),
        ("Country",        lead.get("country",        "—")),
        ("Role",           lead.get("role",           "—")),
        ("Company",        lead.get("company",        "—")),
        ("Company Size",   lead.get("company_size",   "—")),
        ("Features",       features),
        ("Preferred Time", lead.get("preferred_time", "—")),
        ("Notes",          notes),
    ]
    table_rows = "".join(
        f"""<tr>
              <td style="padding:8px 12px;font-weight:600;color:#555;background:#f8f9fa;
                         border-bottom:1px solid #e0e0e0;white-space:nowrap;width:160px;">{k}</td>
              <td style="padding:8px 12px;color:#222;border-bottom:1px solid #e0e0e0;">{v}</td>
            </tr>"""
        for k, v in rows
    )
    return f"""
    <div style="font-family:Inter,sans-serif;max-width:580px;margin:0 auto;padding:32px;background:#f8f9fa;border-radius:12px;">
      <div style="background:#041627;padding:16px 24px;border-radius:8px 8px 0 0;display:flex;align-items:center;gap:12px;">
        <span style="color:#fe6a34;font-size:20px;font-weight:800;letter-spacing:-0.5px;">TRAK<span style="color:#ffffff;">VORA</span></span>
        <span style="color:#8a9199;font-size:13px;margin-left:8px;">New Demo Request</span>
      </div>
      <div style="background:#fff;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;overflow:hidden;">
        <div style="background:#fe6a34;padding:12px 24px;">
          <p style="color:#fff;font-size:14px;font-weight:700;margin:0;">🚀 A new demo request just came in!</p>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          {table_rows}
        </table>
        <div style="padding:16px 24px;">
          <a href="mailto:{lead.get('email','')}"
             style="display:inline-block;background:#fe6a34;color:#fff;font-weight:700;
                    font-size:14px;padding:10px 24px;border-radius:6px;text-decoration:none;">
            Reply to Lead
          </a>
        </div>
      </div>
      <p style="color:#aaa;font-size:11px;margin-top:16px;text-align:center;">
        trakvora — East Africa Freight Exchange
      </p>
    </div>
    """


def _demo_confirmation_html(name: str) -> str:
    first = name.split()[0] if name else "there"
    return f"""
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8f9fa;border-radius:12px;">
      <div style="background:#041627;padding:16px 24px;border-radius:8px 8px 0 0;">
        <span style="color:#fe6a34;font-size:20px;font-weight:800;">TRAK<span style="color:#fff;">VORA</span></span>
      </div>
      <div style="background:#fff;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;padding:28px;">
        <h2 style="color:#041627;font-size:22px;font-weight:700;margin:0 0 12px;">
          You're booked in, {first}!
        </h2>
        <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 16px;">
          Thanks for reaching out. We've received your demo request and a member of our team will be in touch
          within <strong>1 business day</strong> to schedule a time that works for you.
        </p>
        <div style="background:#f8f9fa;border-left:3px solid #fe6a34;padding:12px 16px;border-radius:4px;margin-bottom:20px;">
          <p style="color:#555;font-size:13px;margin:0;">
            In the meantime, feel free to explore our platform or read about how Trakvora works for your role.
          </p>
        </div>
        <a href="https://trakvora.com/pricing"
           style="display:inline-block;background:#fe6a34;color:#fff;font-weight:700;
                  font-size:14px;padding:10px 24px;border-radius:6px;text-decoration:none;">
          View Pricing Plans
        </a>
      </div>
      <p style="color:#aaa;font-size:11px;margin-top:16px;text-align:center;">
        trakvora — East Africa Freight Exchange · Nairobi, Kenya
      </p>
    </div>
    """


async def send_demo_request_internal(lead: dict, support_email: str) -> None:
    logger.info(f"[Demo] New request from {lead.get('email')}")
    if not settings.resend_api_key and (not settings.smtp_username or not settings.smtp_host):
        logger.warning("No email transport configured; skipping demo request email.")
        return
    try:
        html = _demo_internal_html(lead)
        await asyncio.to_thread(
            _send_email, support_email, f"[Demo Request] {lead.get('name')} — {lead.get('company')}", html, FROM_SUPPORT
        )
        logger.info(f"Sent internal demo notification to {support_email}")
    except Exception as exc:
        logger.error(f"Failed to send demo internal email: {exc}")


async def send_demo_confirmation(to_email: str, name: str) -> None:
    logger.info(f"[Demo] Confirmation to {to_email}")
    if not settings.resend_api_key and (not settings.smtp_username or not settings.smtp_host):
        logger.warning("No email transport configured; skipping demo confirmation email.")
        return
    try:
        html = _demo_confirmation_html(name)
        await asyncio.to_thread(
            _send_email, to_email, "Your trakvora demo request is confirmed", html, FROM_NO_REPLY
        )
        logger.info(f"Sent demo confirmation to {to_email}")
    except Exception as exc:
        logger.error(f"Failed to send demo confirmation to {to_email}: {exc}")
