import re

from flask import Blueprint, current_app, g, jsonify, request

from ..auth import login_required, make_token
from ..extensions import db
from ..models import (Club, ClubFollow, Event, ExamPeriod, GoogleAccount, InboxItem, Notification, PushSubscription,
                      Review, SyncedItem, Team, TeamMember, User, UserEvent)
from ..ratelimit import Limiter, rate_limited
from ..utils import ApiError, to_float

bp = Blueprint("auth", __name__, url_prefix="/api/auth")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
LOGIN_LIMIT = Limiter(20, 300)      # 20 FAILED sign-ins per 5 minutes per address (a campus shares one address)
REGISTER_LIMIT = Limiter(30, 3600)  # 30 sign-ups per hour per address


def _goals(value):
    if isinstance(value, list):
        value = ",".join(str(v) for v in value)
    return ",".join(g.strip() for g in (value or "").split(",") if g.strip())


@bp.post("/register")
@rate_limited(REGISTER_LIMIT)
def register():
    d = request.get_json(silent=True) or {}
    name = (d.get("name") or "").strip()
    email = (d.get("email") or "").strip().lower()
    password = d.get("password") or ""
    if not name:
        raise ApiError("Enter your name.")
    if not EMAIL_RE.match(email):
        raise ApiError("Enter a valid email address.")
    if len(password) < 6:
        raise ApiError("Use a password with at least 6 characters.")
    if User.query.filter_by(email=email).first():
        raise ApiError("An account with this email already exists. Sign in instead.", 409)
    user = User(
        name=name, email=email, college=(d.get("college") or "").strip() or None,
        college_lat=to_float(d.get("college_lat")), college_lng=to_float(d.get("college_lng")),
        goals=_goals(d.get("goals")),
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify(token=make_token(user.id), user=user.to_dict()), 201


@bp.post("/login")
def login():
    ip = request.remote_addr or "unknown"
    limited = not current_app.config.get("TESTING")
    if limited and LOGIN_LIMIT.blocked(ip):
        raise ApiError("Too many failed sign-in attempts. Wait a few minutes and try again.", 429)
    d = request.get_json(silent=True) or {}
    user = User.query.filter_by(email=(d.get("email") or "").strip().lower()).first()
    if not user or not user.check_password(d.get("password") or ""):
        if limited:
            LOGIN_LIMIT.hit(ip)
        raise ApiError("Email or password is incorrect.", 401)
    return jsonify(token=make_token(user.id), user=user.to_dict())


@bp.get("/me")
@login_required
def me():
    return jsonify(user=g.user.to_dict())


@bp.put("/me")
@login_required
def update_me():
    d = request.get_json(silent=True) or {}
    u = g.user
    if "name" in d:
        name = (d["name"] or "").strip()
        if not name:
            raise ApiError("Enter your name.")
        u.name = name
    if "college" in d:
        u.college = (d["college"] or "").strip() or None
    if "college_lat" in d:
        u.college_lat = to_float(d["college_lat"])
    if "college_lng" in d:
        u.college_lng = to_float(d["college_lng"])
    if "goals" in d:
        u.goals = _goals(d["goals"])
    db.session.commit()
    return jsonify(user=u.to_dict())


@bp.delete("/me")
@login_required
def delete_account():
    """Delete the account and everything tied to it. Needs the password."""
    from ..services import google_calendar as gc

    d = request.get_json(silent=True) or {}
    if not g.user.check_password(d.get("password") or ""):
        raise ApiError("That password is not correct.", 403)
    uid = g.user.id

    try:  # removes the events Eventure added to Google Calendar and revokes access
        gc.disconnect(current_app.config, uid)
    except Exception:
        pass

    # teams: hand ownership to another member, or remove the team if the student was alone in it
    for member in TeamMember.query.filter_by(user_id=uid).all():
        team = db.session.get(Team, member.team_id)
        others = TeamMember.query.filter(TeamMember.team_id == member.team_id, TeamMember.user_id != uid).all()
        db.session.delete(member)
        if team and team.owner_id == uid:
            if others:
                team.owner_id = others[0].user_id
            else:
                UserEvent.query.filter_by(team_id=team.id).update({"team_id": None})
                db.session.flush()
                db.session.delete(team)
    db.session.flush()

    for ue in UserEvent.query.filter_by(user_id=uid).all():
        db.session.delete(ue)  # stages go with it
    db.session.flush()
    for model in (Review, Notification, PushSubscription, InboxItem, ExamPeriod, ClubFollow, SyncedItem, GoogleAccount):
        model.query.filter_by(user_id=uid).delete()

    for ev in Event.query.filter_by(created_by=uid).all():
        if not ev.is_public and not UserEvent.query.filter_by(event_id=ev.id).first():
            db.session.delete(ev)  # private events nobody else has
        else:
            ev.created_by = None   # public events stay for the students who joined
    Club.query.filter_by(created_by=uid).update({"created_by": None})
    db.session.flush()
    db.session.delete(g.user)
    db.session.commit()
    return jsonify(ok=True)
