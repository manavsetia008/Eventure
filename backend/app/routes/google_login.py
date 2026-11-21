"""Sign in with Google: /auth/google starts the flow, /auth/google/callback finishes it.

Once Google confirms the account we set the same JWT session the email/password login uses and
hand the browser back to the frontend, which stores it and lands on the timeline.
"""
import secrets

from flask import Blueprint, current_app, redirect, request

from ..auth import make_token
from ..extensions import db
from ..models import User
from ..services import google_signin as gs

bp = Blueprint("google_login", __name__, url_prefix="/auth")


def _login_url(query=""):
    base = current_app.config["FRONTEND_URL"] + "/login"
    return f"{base}?{query}" if query else base


def _fail():
    """Any cancel or error goes back to the sign-in page with a plain, non-technical notice."""
    resp = redirect(_login_url("google=cancelled"))
    resp.delete_cookie("g_state")
    resp.delete_cookie("g_verifier")
    return resp


@bp.get("/google")
def start():
    cfg = current_app.config
    if not gs.configured(cfg):
        return redirect(_login_url("google=unavailable"))
    state = secrets.token_urlsafe(32)
    verifier = gs.make_verifier()
    resp = redirect(gs.build_auth_url(cfg, state, gs.challenge(verifier)))
    secure = cfg["APP_BASE_URL"].startswith("https")
    resp.set_cookie("g_state", state, max_age=600, httponly=True, samesite="Lax", secure=secure)
    resp.set_cookie("g_verifier", verifier, max_age=600, httponly=True, samesite="Lax", secure=secure)
    return resp


@bp.get("/google/callback")
def callback():
    cfg = current_app.config
    state = request.args.get("state", "")
    cookie_state = request.cookies.get("g_state", "")
    verifier = request.cookies.get("g_verifier", "")
    # state guards against CSRF; the verifier pairs with the PKCE challenge sent earlier
    if request.args.get("error") or not state or state != cookie_state or not verifier:
        return _fail()
    code = request.args.get("code")
    if not code:
        return _fail()
    try:
        tokens = gs.exchange_code(cfg, code, verifier)
        claims = gs.verify_id_token(cfg, tokens.get("id_token") or "")
    except Exception:
        current_app.logger.warning("Google sign-in could not complete the token exchange.")
        return _fail()

    email = (claims.get("email") or "").strip().lower()
    if not email or not gs.email_verified(claims):
        return _fail()

    user = User.query.filter_by(email=email).first()
    if user:  # an existing email/password account signs in with Google and keeps its data
        if not user.google_id:
            user.google_id = claims.get("sub")
    else:     # first time here: create the account with no password
        user = User(
            name=(claims.get("name") or email.split("@")[0]).strip(),
            email=email,
            google_id=claims.get("sub"),
        )
        db.session.add(user)
    db.session.commit()

    resp = redirect(f"{cfg['FRONTEND_URL']}/login#google_token={make_token(user.id)}")
    resp.delete_cookie("g_state")
    resp.delete_cookie("g_verifier")
    return resp
