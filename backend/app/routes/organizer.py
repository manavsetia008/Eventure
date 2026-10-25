from flask import Blueprint, g, jsonify, request
from sqlalchemy import func

from ..auth import login_required
from ..extensions import db
from ..models import Event, Review, UserEvent
from ..utils import ApiError, now

bp = Blueprint("organizer", __name__, url_prefix="/api/organizer")


@bp.get("/events")
@login_required
def my_events():
    """Events this user listed, with how many students are interested, registered and attended."""
    events = Event.query.filter_by(created_by=g.user.id).order_by(Event.start_at.desc()).all()
    ids = [e.id for e in events]
    counts = {i: {"interested": 0, "registered": 0, "attended": 0, "skipped": 0} for i in ids}
    if ids:
        rows = (db.session.query(UserEvent.event_id, UserEvent.status, func.count(UserEvent.id))
                .filter(UserEvent.event_id.in_(ids)).group_by(UserEvent.event_id, UserEvent.status).all())
        for eid, status, n in rows:
            counts[eid][status] = int(n)
    ratings = {}
    if ids:
        for eid, avg, n in (db.session.query(Review.event_id, func.avg(Review.overall), func.count(Review.id))
                            .filter(Review.event_id.in_(ids)).group_by(Review.event_id).all()):
            ratings[eid] = {"avg": round(float(avg), 1), "count": int(n)}
    now_ = now()
    return jsonify(events=[{
        **e.to_dict(),
        "upcoming": bool(e.start_at and e.start_at >= now_),
        "counts": counts[e.id],
        "rating": ratings.get(e.id, {"avg": None, "count": 0}),
    } for e in events])


@bp.post("/events/<int:event_id>/visibility")
@login_required
def set_visibility(event_id):
    ev = db.session.get(Event, event_id)
    if not ev or ev.created_by != g.user.id:
        raise ApiError("You can only change events you listed.", 404)
    ev.is_public = bool((request.get_json(silent=True) or {}).get("is_public"))
    db.session.commit()
    return jsonify(is_public=ev.is_public)
