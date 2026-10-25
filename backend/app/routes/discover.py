from flask import Blueprint, g, jsonify, request
from sqlalchemy import func

from ..auth import login_required
from ..extensions import db
from ..models import STATUSES, Event, Review, Stage, UserEvent
from ..services.priority import goal_fit, score_item
from ..services.travel import estimate_minutes, haversine_km
from ..utils import ApiError, now

bp = Blueprint("discover", __name__, url_prefix="/api")

PRIOR_MEAN, PRIOR_WEIGHT = 3.5, 3  # keeps one 5-star review from outranking twenty 4.6s


def rating_table(event_ids=None):
    q = db.session.query(
        Review.event_id, func.avg(Review.overall), func.count(Review.id),
        func.avg(Review.organisation), func.avg(Review.learning), func.avg(Review.value),
    ).group_by(Review.event_id)
    if event_ids is not None:
        q = q.filter(Review.event_id.in_(event_ids))
    out = {}
    for eid, avg, count, org, learn, val in q.all():
        out[eid] = {
            "avg": round(float(avg), 1), "count": int(count),
            "organisation": round(float(org), 1), "learning": round(float(learn), 1), "value": round(float(val), 1),
            "bayes": (PRIOR_WEIGHT * PRIOR_MEAN + float(avg) * count) / (PRIOR_WEIGHT + count),
        }
    return out


NO_RATING = {"avg": None, "count": 0, "organisation": None, "learning": None, "value": None, "bayes": PRIOR_MEAN}


def event_card(ev, user, ratings, in_timeline):
    dist = None
    if user.college_lat is not None and ev.lat is not None:
        dist = round(haversine_km(user.college_lat, user.college_lng, ev.lat, ev.lng), 1)
    travel = estimate_minutes(user.college_lat, user.college_lng, ev.lat, ev.lng)  # offline estimate for lists
    r = ratings.get(ev.id, NO_RATING)
    fit, _ = goal_fit(user.goals_list, ev.category, ev.title, ev.description)
    prox = max(0.0, 1 - dist / 50) if dist is not None else 0.3
    rank = round(100 * (0.5 * r["bayes"] / 5 + 0.3 * prox + 0.2 * fit / 40), 1)
    return {
        **ev.to_dict(), "distance_km": dist, "travel_minutes": travel,
        "rating": {k: r[k] for k in ("avg", "count", "organisation", "learning", "value")},
        "in_timeline": ev.id in in_timeline, "rank": rank,
    }


@bp.get("/discover")
@login_required
def discover():
    user, now_ = g.user, now()
    q = Event.query.filter(Event.is_public.is_(True), Event.start_at >= now_)
    category = (request.args.get("category") or "").strip().lower()
    if category:
        q = q.filter(func.lower(Event.category) == category)
    text = (request.args.get("q") or "").strip().lower()
    if text:
        like = f"%{text}%"
        q = q.filter(func.lower(Event.title).like(like) | func.lower(Event.description).like(like) | func.lower(Event.venue_name).like(like))
    events = q.order_by(Event.start_at).limit(200).all()

    ratings = rating_table([e.id for e in events])
    mine = {ue.event_id for ue in UserEvent.query.filter_by(user_id=user.id).all()}
    cards = [event_card(e, user, ratings, mine) for e in events]

    radius = request.args.get("radius_km", type=float)
    if radius:
        cards = [c for c in cards if c["distance_km"] is None or c["distance_km"] <= radius]
    sort = request.args.get("sort", "rank")
    if sort == "date":
        cards.sort(key=lambda c: c["start_at"] or "")
    elif sort == "distance":
        cards.sort(key=lambda c: (c["distance_km"] is None, c["distance_km"] or 0))
    else:
        cards.sort(key=lambda c: -c["rank"])
    college = {"name": user.college, "lat": user.college_lat, "lng": user.college_lng}
    return jsonify(events=cards, college=college)


@bp.get("/events/<int:event_id>")
@login_required
def event_detail(event_id):
    user = g.user
    ev = db.session.get(Event, event_id)
    if not ev or (not ev.is_public and ev.created_by != user.id and not UserEvent.query.filter_by(user_id=user.id, event_id=ev.id).first()):
        raise ApiError("That event does not exist.", 404)
    ratings = rating_table([ev.id])
    ue = UserEvent.query.filter_by(user_id=user.id, event_id=ev.id).first()
    mine = {ev.id} if ue else set()
    card = event_card(ev, user, ratings, mine)
    reviews = Review.query.filter_by(event_id=ev.id).order_by(Review.created_at.desc()).all()
    already = any(r.user_id == user.id for r in reviews)

    can_review, reason = True, None
    if already:
        can_review, reason = False, "You have already reviewed this event."
    elif not ue or ue.status != "attended":
        can_review, reason = False, "Only students who attended can review. Mark this event as attended on your timeline first."
    elif ev.start_at and ev.start_at > now():
        can_review, reason = False, "You can review once the event has started."
    return jsonify(
        event=card,
        reviews=[{**r.to_dict(), "mine": r.user_id == user.id} for r in reviews],
        mine={"user_event_id": ue.id if ue else None, "status": ue.status if ue else None,
              "can_review": can_review, "review_blocked_reason": reason, "is_owner": ev.created_by == user.id},
    )


@bp.post("/events/<int:event_id>/join")
@login_required
def join_event(event_id):
    ev = db.session.get(Event, event_id)
    if not ev or not ev.is_public:
        raise ApiError("That event does not exist.", 404)
    d = request.get_json(silent=True) or {}
    status = d.get("status") if d.get("status") in STATUSES else "interested"
    ue = UserEvent.query.filter_by(user_id=g.user.id, event_id=ev.id).first()
    if ue:
        ue.status = status
    else:
        ue = UserEvent(user_id=g.user.id, event_id=ev.id, status=status)
        db.session.add(ue)
        db.session.flush()
        if ev.registration_deadline:
            db.session.add(Stage(user_event_id=ue.id, name="Register", due_at=ev.registration_deadline))
    db.session.commit()
    return jsonify(user_event_id=ue.id, status=ue.status), 201


@bp.post("/events/<int:event_id>/reviews")
@login_required
def add_review(event_id):
    ev = db.session.get(Event, event_id)
    if not ev:
        raise ApiError("That event does not exist.", 404)
    ue = UserEvent.query.filter_by(user_id=g.user.id, event_id=ev.id).first()
    if not ue or ue.status != "attended":
        raise ApiError("Only students who attended can review. Mark this event as attended on your timeline first.", 403)
    if ev.start_at and ev.start_at > now():
        raise ApiError("You can review once the event has started.", 403)
    if Review.query.filter_by(user_id=g.user.id, event_id=ev.id).first():
        raise ApiError("You have already reviewed this event.", 409)
    d = request.get_json(silent=True) or {}
    dims = {}
    for k in ("organisation", "learning", "value"):
        try:
            v = int(d.get(k))
        except (TypeError, ValueError):
            raise ApiError(f"Rate {k} from 1 to 5.")
        if not 1 <= v <= 5:
            raise ApiError(f"Rate {k} from 1 to 5.")
        dims[k] = v
    overall = round(sum(dims.values()) / 3, 1)
    review = Review(event_id=ev.id, user_id=g.user.id, overall=overall, comment=(d.get("comment") or "").strip()[:1500], **dims)
    db.session.add(review)
    db.session.commit()
    return jsonify(review=review.to_dict()), 201


@bp.delete("/events/<int:event_id>/reviews/mine")
@login_required
def delete_my_review(event_id):
    row = Review.query.filter_by(event_id=event_id, user_id=g.user.id).first()
    if not row:
        raise ApiError("You have not reviewed this event.", 404)
    db.session.delete(row)
    db.session.commit()
    return jsonify(ok=True)


@bp.get("/compare")
@login_required
def compare():
    try:
        ids = [int(x) for x in (request.args.get("ids") or "").split(",") if x.strip()][:3]
    except ValueError:
        raise ApiError("Pick events to compare.")
    if len(ids) < 2:
        raise ApiError("Pick at least two events to compare.")
    events = Event.query.filter(Event.id.in_(ids), Event.is_public.is_(True)).all()
    ratings = rating_table(ids)
    mine = {ue.event_id for ue in UserEvent.query.filter_by(user_id=g.user.id).all()}
    user, now_ = g.user, now()
    rows = []
    for ev in events:
        card = event_card(ev, user, ratings, mine)
        item = {"title": ev.title, "category": ev.category, "description": ev.description, "status": "interested",
                "start": ev.start_at, "stages": [], "travel_minutes": card["travel_minutes"], "in_exam": False}
        card["fit_score"] = score_item(item, user.goals_list, now_)["score"]
        rows.append(card)
    rows.sort(key=lambda c: ids.index(c["id"]))
    return jsonify(events=rows)
