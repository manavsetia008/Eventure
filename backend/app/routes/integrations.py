import os
import requests
from flask import Blueprint, current_app, g, jsonify, request
from ..auth import login_required
from ..models import GoogleAccount

bp = Blueprint("integrations", __name__, url_prefix="/api/integrations")


def _is_configured(val):
    if not val:
        return False
    s = str(val).strip()
    if not s or "placeholder" in s.lower() or s.startswith("your_") or s == "test":
        return False
    return True


@bp.get("/status")
@login_required
def get_integrations_status():
    cfg = current_app.config

    sarvam_key = _is_configured(cfg.get("SARVAM_API_KEY"))
    google_cal = _is_configured(cfg.get("GOOGLE_CLIENT_ID")) and _is_configured(cfg.get("GOOGLE_CLIENT_SECRET"))
    google_connected = bool(GoogleAccount.query.filter_by(user_id=g.user.id).first()) if hasattr(g, "user") and g.user else False
    vapid_push = _is_configured(cfg.get("VAPID_PUBLIC_KEY")) and _is_configured(cfg.get("VAPID_PRIVATE_KEY"))
    imap_sync = _is_configured(cfg.get("IMAP_HOST")) and _is_configured(cfg.get("IMAP_USER")) and _is_configured(cfg.get("IMAP_PASSWORD"))

    integrations = [
        {
            "id": "sarvam",
            "name": "Smart extraction and translation",
            "env_var": "SARVAM_API_KEY",
            "connected": sarvam_key,
            "available": sarvam_key,
            "purpose": "Read event details from posters and text, and translate to Hindi or Hinglish.",
        },
        {
            "id": "travel",
            "name": "Travel time",
            "env_var": "GOOGLE_MAPS_API_KEY",
            "connected": True,  # Free OSM Nominatim + Haversine default
            "available": True,
            "purpose": "Shows how long it takes to reach each venue, including rush hour.",
        },
        {
            "id": "push",
            "name": "Reminders",
            "env_var": "VAPID_PUBLIC_KEY & VAPID_PRIVATE_KEY",
            "connected": vapid_push,
            "available": vapid_push,
            "purpose": "Get a browser notification 48, 24 and 6 hours before a deadline.",
        },
        {
            "id": "google_calendar",
            "name": "Google Calendar",
            "env_var": "GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET",
            "connected": google_connected,
            "available": google_cal,
            "purpose": "Add shortlisted events to your calendar and flag clashes with your own plans.",
        },
        {
            "id": "imap",
            "name": "Registration emails",
            "env_var": "IMAP_HOST, IMAP_USER & IMAP_PASSWORD",
            "connected": imap_sync,
            "available": imap_sync,
            "purpose": "Reads confirmation emails from Unstop, Devfolio and Hack2skill to track your registration status.",
        },
    ]

    return jsonify(integrations=integrations)


@bp.post("/test/<string:service>")
@login_required
def test_integration(service):
    cfg = current_app.config

    if service == "sarvam":
        key = cfg.get("SARVAM_API_KEY")
        if not _is_configured(key):
            return jsonify(ok=False, message="Could not connect. Check your settings.")
        try:
            resp = requests.post(
                "https://api.sarvam.ai/translate",
                headers={"api-subscription-key": key, "Content-Type": "application/json"},
                json={
                    "input": "Hackathon",
                    "source_language_code": "en-IN",
                    "target_language_code": "hi-IN",
                    "model": "sarvam-translate:v1",
                },
                timeout=5,
            )
            if resp.status_code == 200:
                return jsonify(ok=True, message="Working")
            return jsonify(ok=False, message="Could not connect. Check your settings.")
        except Exception:
            return jsonify(ok=False, message="Could not connect. Check your settings.")

    elif service == "travel":
        return jsonify(ok=True, message="Working")

    elif service == "push":
        pub = cfg.get("VAPID_PUBLIC_KEY")
        priv = cfg.get("VAPID_PRIVATE_KEY")
        if _is_configured(pub) and _is_configured(priv):
            return jsonify(ok=True, message="Working")
        return jsonify(ok=False, message="Could not connect. Check your settings.")

    elif service == "google_calendar":
        cid = cfg.get("GOOGLE_CLIENT_ID")
        sec = cfg.get("GOOGLE_CLIENT_SECRET")
        if _is_configured(cid) and _is_configured(sec):
            return jsonify(ok=True, message="Working")
        return jsonify(ok=False, message="Could not connect. Check your settings.")

    elif service == "imap":
        host = cfg.get("IMAP_HOST")
        user = cfg.get("IMAP_USER")
        if _is_configured(host) and _is_configured(user):
            return jsonify(ok=True, message="Working")
        return jsonify(ok=False, message="Could not connect. Check your settings.")

    return jsonify(ok=False, message=f"Unknown service '{service}'."), 404


@bp.post("/disconnect/<string:service>")
@login_required
def disconnect_integration(service):
    if service == "google_calendar":
        from ..services import google_calendar as gc
        gc.disconnect(current_app.config, g.user.id)
        return jsonify(ok=True, message="Disconnected")
    return jsonify(ok=True, message="Disconnected")
