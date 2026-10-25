from datetime import datetime, timedelta, timezone

from flask import Blueprint, current_app, g, jsonify, redirect, request

from ..auth import login_required
from ..extensions import db
from ..models import GoogleAccount
from ..services import google_calendar as gc
from ..utils import ApiError

bp = Blueprint("google", __name__, url_prefix="/api/google")


def _settings_url(result):
    return f"{current_app.config['FRONTEND_URL']}/settings?google={result}"


@bp.get("/status")
@login_required
def status():
    account = GoogleAccount.query.filter_by(user_id=g.user.id).first()
    return jsonify(
        configured=gc.configured(current_app.config),
        connected=account is not None,
        last_sync=account.last_sync.isoformat(timespec="minutes") if account and account.last_sync else None,
    )


@bp.get("/connect")
@login_required
def connect():
    if not gc.configured(current_app.config):
        raise ApiError("Google Calendar sync is not set up on this server. Add the Google client ID and secret first.", 501)
    state = gc.make_state(g.user.id, current_app.config["SECRET_KEY"])
    return jsonify(url=gc.build_auth_url(current_app.config, state))


@bp.get("/callback")
def callback():
    """Google redirects the browser here after the student agrees (or declines)."""
    if request.args.get("error"):
        return redirect(_settings_url("declined"))
    user_id = gc.read_state(request.args.get("state", ""), current_app.config["SECRET_KEY"])
    code = request.args.get("code")
    if not user_id or not code:
        return redirect(_settings_url("error"))
    try:
        tokens = gc.exchange_code(current_app.config, code)
    except Exception:
        return redirect(_settings_url("error"))
    account = GoogleAccount.query.filter_by(user_id=user_id).first()
    refresh = tokens.get("refresh_token") or (account.refresh_token if account else None)
    if not refresh:
        return redirect(_settings_url("error"))
    if not account:
        account = GoogleAccount(user_id=user_id, refresh_token=refresh)
        db.session.add(account)
    account.refresh_token = refresh
    account.access_token = tokens.get("access_token")
    expires = datetime.now(timezone.utc) + timedelta(seconds=int(tokens.get("expires_in", 3600)))
    account.expires_at = expires.replace(tzinfo=None)
    db.session.commit()
    gc.clear_cache(user_id)
    return redirect(_settings_url("connected"))


@bp.post("/sync")
@login_required
def sync():
    if not GoogleAccount.query.filter_by(user_id=g.user.id).first():
        raise ApiError("Connect Google Calendar first.", 400)
    try:
        counts = gc.sync_user(current_app.config, g.user.id)
    except Exception as exc:
        current_app.logger.warning("Google sync failed: %s", exc)
        raise ApiError("Google Calendar did not accept the sync. Disconnect and connect again, then retry.", 502)
    return jsonify(counts=counts)


@bp.post("/disconnect")
@login_required
def disconnect():
    gc.disconnect(current_app.config, g.user.id)
    return jsonify(ok=True)
