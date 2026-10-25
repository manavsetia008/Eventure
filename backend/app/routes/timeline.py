from datetime import timedelta

from flask import Blueprint, Response, current_app, g, jsonify, request

from ..auth import login_required
from ..extensions import db
from ..models import STATUSES, Event, ExamPeriod, InboxItem, Notification, Stage, UserEvent
from ..services.conflicts import detect_external_clashes, detect_issues, effective_end
from ..services.extraction import extract_event
from ..services.google_calendar import get_external_events
from ..services.ics import build_ics
from ..services.ocr import OCRUnavailable, image_to_text
from ..services.priority import score_item, suggest_between, suggest_for_exam
from ..services.reminders import run_reminder_check
from ..services.travel import estimate_minutes, geocode
from ..utils import ApiError, iso, now, parse_date, parse_dt, to_float, to_int

bp = Blueprint("timeline", __name__, url_prefix="/api")


def maps_key():
    return current_app.config.get("GOOGLE_MAPS_API_KEY") or None


def look_up(venue):
    return geocode(venue, maps_key(), current_app.config.get("GEOCODE_OSM", True))


def own_user_event(ue_id):
    ue = db.session.get(UserEvent, ue_id)
    if not ue or ue.user_id != g.user.id:
        raise ApiError("That event is not on your timeline.", 404)
    return ue


def logic_item(ue, user, exams, key=None):
    """Plain-dict view of a user's event used by the clash and priority logic."""
    ev = ue.event
    travel = estimate_minutes(user.college_lat, user.college_lng, ev.lat, ev.lng, key)
    in_exam = False
    if ev.start_at:
        e_start, e_end = ev.start_at.date(), effective_end({"start": ev.start_at, "end": ev.end_at}).date()
        in_exam = any(e_start <= p.end_date and p.start_date <= e_end for p in exams)
    return {
        "id": ue.id, "title": ev.title, "category": ev.category, "description": ev.description,
        "status": ue.status, "start": ev.start_at, "end": ev.end_at, "lat": ev.lat, "lng": ev.lng,
        "venue": ev.venue_name, "travel_minutes": travel, "in_exam": in_exam,
        "stages": [{"name": s.name, "due": s.due_at, "done": bool(s.done)} for s in ue.stages],
    }


def serialize_user_event(ue, item=None, score=None, now_=None):
    now_ = now_ or now()
    ev = ue.event
    undone = [s for s in ue.stages if not s.done and s.due_at]
    next_stage = min(undone, key=lambda s: s.due_at) if undone else None
    past = bool(ev.start_at and effective_end({"start": ev.start_at, "end": ev.end_at}) < now_)
    risk = None
    if next_stage and not past:  # a missed deadline on an event that is over is not actionable
        hours = (next_stage.due_at - now_).total_seconds() / 3600
        risk = "overdue" if hours < 0 else "high" if hours <= 48 else "medium" if hours <= 24 * 7 else "low"
    return {
        "id": ue.id,
        "status": ue.status,
        "team_id": ue.team_id,
        "notes": ue.notes,
        "event": ev.to_dict(),
        "stages": [s.to_dict() for s in ue.stages],
        "next_deadline": {"name": next_stage.name, "due_at": iso(next_stage.due_at)} if next_stage else None,
        "risk": risk,
        "past": past,
        "travel_minutes": item["travel_minutes"] if item else None,
        "score": score,
    }


@bp.post("/extract")
@login_required
def extract():
    text, ocr_text = "", None
    upload = request.files.get("image")
    if upload:
        try:
            ocr_text = image_to_text(upload.read())
        except OCRUnavailable as exc:
            raise ApiError(str(exc), 422)
        text = ocr_text
    typed = request.form.get("text") or (request.get_json(silent=True) or {}).get("text") or ""
    text = f"{text}\n{typed}".strip()
    if not text:
        raise ApiError("Paste the event text or upload a poster.")
    parsed = extract_event(text, now(), current_app.config["ANTHROPIC_API_KEY"] or None, current_app.config["ANTHROPIC_MODEL"])
    return jsonify(parsed=parsed, ocr_text=ocr_text)


@bp.post("/events")
@login_required
def create_event():
    d = request.get_json(silent=True) or {}
    title = (d.get("title") or "").strip()
    if not title:
        raise ApiError("Add a title for the event.")
    start, end = parse_dt(d.get("start_at")), parse_dt(d.get("end_at"))
    if start and end and end < start:
        raise ApiError("The end time is before the start time.")
    reg = parse_dt(d.get("registration_deadline"))
    lat, lng = to_float(d.get("lat")), to_float(d.get("lng"))
    venue = (d.get("venue_name") or "").strip() or None
    if (lat is None or lng is None) and venue:
        point = look_up(venue)
        if point:
            lat, lng = point
    ev = Event(
        title=title[:250], platform=(d.get("platform") or None), category=(d.get("category") or "other").lower(),
        description=d.get("description") or "", venue_name=venue, lat=lat, lng=lng, start_at=start, end_at=end,
        registration_deadline=reg, url=d.get("url") or None, is_public=bool(d.get("is_public")), created_by=g.user.id,
    )
    db.session.add(ev)
    db.session.flush()
    status = d.get("status") if d.get("status") in STATUSES else "registered"
    ue = UserEvent(user_id=g.user.id, event_id=ev.id, status=status)
    db.session.add(ue)
    db.session.flush()

    stages = list(d.get("stages") or [])
    if reg and not any((s.get("name") or "").lower().startswith("regist") for s in stages):
        stages.insert(0, {"name": "Register", "due_at": iso(reg)})
    for s in stages:
        name = (s.get("name") or "").strip()
        if name:
            db.session.add(Stage(user_event_id=ue.id, name=name[:120], due_at=parse_dt(s.get("due_at"))))
    inbox_id = to_int(d.get("inbox_item_id"))
    if inbox_id is not None:
        item = db.session.get(InboxItem, inbox_id)
        if item and item.user_id == g.user.id:
            item.status = "added"
    db.session.commit()
    return jsonify(user_event=serialize_user_event(ue)), 201


@bp.post("/geocode")
@login_required
def geocode_venue():
    venue = ((request.get_json(silent=True) or {}).get("venue") or "").strip()
    if not venue:
        raise ApiError("Type the venue first.")
    point = look_up(venue)
    if not point:
        raise ApiError("Could not find that place. Try adding the city, or enter the coordinates by hand.", 404)
    return jsonify(lat=round(point[0], 5), lng=round(point[1], 5))


@bp.put("/events/<int:event_id>")
@login_required
def update_event(event_id):
    ev = db.session.get(Event, event_id)
    if not ev or ev.created_by != g.user.id:
        raise ApiError("You can only edit events you added.", 404)
    d = request.get_json(silent=True) or {}
    if "title" in d:
        title = (d["title"] or "").strip()
        if not title:
            raise ApiError("Add a title for the event.")
        ev.title = title[:250]
    if "category" in d:
        ev.category = (d["category"] or "other").lower()
    for key in ("platform", "url"):
        if key in d:
            setattr(ev, key, (d[key] or "").strip() or None)
    if "description" in d:
        ev.description = d["description"] or ""
    if "venue_name" in d:
        ev.venue_name = (d["venue_name"] or "").strip() or None
    if "lat" in d or "lng" in d:
        ev.lat, ev.lng = to_float(d.get("lat")), to_float(d.get("lng"))
    for key in ("start_at", "end_at", "registration_deadline"):
        if key in d:
            setattr(ev, key, parse_dt(d[key]))
    if ev.start_at and ev.end_at and ev.end_at < ev.start_at:
        raise ApiError("The end time is before the start time.")
    if "is_public" in d:
        ev.is_public = bool(d["is_public"])
    if (ev.lat is None or ev.lng is None) and ev.venue_name:
        point = look_up(ev.venue_name)
        if point:
            ev.lat, ev.lng = point
    db.session.commit()
    return jsonify(event=ev.to_dict())


@bp.get("/timeline")
@login_required
def timeline():
    user, key, now_ = g.user, maps_key(), now()
    uevs = UserEvent.query.filter_by(user_id=user.id).all()
    exams = ExamPeriod.query.filter_by(user_id=user.id).all()
    goals = user.goals_list

    items = {ue.id: logic_item(ue, user, exams, key) for ue in uevs}
    scores = {i: score_item(it, goals, now_) for i, it in items.items()}

    upcoming = [
        it for it in items.values()
        if it["status"] != "skipped" and it["start"] and effective_end(it) >= now_
    ]
    exam_dicts = [{"label": p.label, "start": p.start_date, "end": p.end_date} for p in exams]
    travel_fn = lambda a, b: estimate_minutes(a["lat"], a["lng"], b["lat"], b["lng"], key)  # noqa: E731
    issues = detect_issues(upcoming, exam_dicts, travel_fn)

    issues += detect_external_clashes(upcoming, get_external_events(current_app.config, user.id, now_))

    for issue in issues:
        ids = issue["events"]
        if len(ids) == 2:
            a, b = items[ids[0]], items[ids[1]]
            between = estimate_minutes(a["lat"], a["lng"], b["lat"], b["lng"], key)
            issue["suggestion"] = suggest_between(a, scores[a["id"]], b, scores[b["id"]], between or None)
        elif issue["type"] == "exam_week":
            it = items[ids[0]]
            issue["suggestion"] = suggest_for_exam(it, scores[it["id"]], issue["meta"]["exam"])
        issue["titles"] = [items[i]["title"] for i in ids]

    serialized = [serialize_user_event(ue, items[ue.id], scores[ue.id]["score"], now_) for ue in uevs]
    far = now_ + timedelta(days=3650)

    def sort_key(s):
        if s["past"]:
            return (1, -(parse_dt(s["event"]["start_at"]) or now_).timestamp())
        nd = parse_dt(s["next_deadline"]["due_at"]) if s["next_deadline"] else None
        start = parse_dt(s["event"]["start_at"]) or far
        return (0, min(x for x in (nd, start) if x).timestamp())

    serialized.sort(key=sort_key)
    return jsonify(items=serialized, issues=issues)


@bp.patch("/user-events/<int:ue_id>")
@login_required
def update_user_event(ue_id):
    ue, d = own_user_event(ue_id), request.get_json(silent=True) or {}
    if "status" in d:
        if d["status"] not in STATUSES:
            raise ApiError("Pick a valid status: " + ", ".join(STATUSES) + ".")
        ue.status = d["status"]
    if "notes" in d:
        ue.notes = d["notes"] or ""
    db.session.commit()
    return jsonify(user_event=serialize_user_event(ue))


@bp.delete("/user-events/<int:ue_id>")
@login_required
def delete_user_event(ue_id):
    ue = own_user_event(ue_id)
    ev = ue.event
    db.session.delete(ue)
    db.session.flush()
    # a private event nobody else has is just clutter once it leaves the timeline
    if not ev.is_public and ev.created_by == g.user.id and not UserEvent.query.filter_by(event_id=ev.id).first():
        db.session.delete(ev)
    db.session.commit()
    return jsonify(ok=True)


@bp.post("/user-events/<int:ue_id>/stages")
@login_required
def add_stage(ue_id):
    ue, d = own_user_event(ue_id), request.get_json(silent=True) or {}
    name = (d.get("name") or "").strip()
    if not name:
        raise ApiError("Name the stage, for example Submit or Shortlist.")
    stage = Stage(user_event_id=ue.id, name=name[:120], due_at=parse_dt(d.get("due_at")))
    db.session.add(stage)
    db.session.commit()
    return jsonify(stage=stage.to_dict()), 201


def own_stage(stage_id):
    st = db.session.get(Stage, stage_id)
    if not st:
        raise ApiError("That stage does not exist.", 404)
    own_user_event(st.user_event_id)
    return st


@bp.patch("/stages/<int:stage_id>")
@login_required
def update_stage(stage_id):
    st, d = own_stage(stage_id), request.get_json(silent=True) or {}
    if "done" in d:
        st.done = bool(d["done"])
    if "name" in d and (d["name"] or "").strip():
        st.name = d["name"].strip()[:120]
    if "due_at" in d:
        st.due_at = parse_dt(d["due_at"])
    db.session.commit()
    return jsonify(stage=st.to_dict())


@bp.delete("/stages/<int:stage_id>")
@login_required
def delete_stage(stage_id):
    st = own_stage(stage_id)
    db.session.delete(st)
    db.session.commit()
    return jsonify(ok=True)


@bp.get("/exams")
@login_required
def list_exams():
    rows = ExamPeriod.query.filter_by(user_id=g.user.id).order_by(ExamPeriod.start_date).all()
    return jsonify(exams=[r.to_dict() for r in rows])


@bp.post("/exams")
@login_required
def add_exam():
    d = request.get_json(silent=True) or {}
    label, start, end = (d.get("label") or "").strip(), parse_date(d.get("start_date")), parse_date(d.get("end_date"))
    if not label or not start or not end:
        raise ApiError("Add a label, a start date and an end date.")
    if end < start:
        raise ApiError("The end date is before the start date.")
    row = ExamPeriod(user_id=g.user.id, label=label[:120], start_date=start, end_date=end)
    db.session.add(row)
    db.session.commit()
    return jsonify(exam=row.to_dict()), 201


@bp.delete("/exams/<int:exam_id>")
@login_required
def delete_exam(exam_id):
    row = db.session.get(ExamPeriod, exam_id)
    if not row or row.user_id != g.user.id:
        raise ApiError("That exam period does not exist.", 404)
    db.session.delete(row)
    db.session.commit()
    return jsonify(ok=True)


@bp.get("/notifications")
@login_required
def list_notifications():
    rows = Notification.query.filter_by(user_id=g.user.id).order_by(Notification.created_at.desc(), Notification.id.desc()).limit(50).all()
    unread = Notification.query.filter_by(user_id=g.user.id, read=False).count()
    inbox_pending = InboxItem.query.filter_by(user_id=g.user.id, status="pending").count()
    return jsonify(notifications=[r.to_dict() for r in rows], unread=unread, inbox_pending=inbox_pending)


@bp.post("/notifications/read-all")
@login_required
def read_all_notifications():
    Notification.query.filter_by(user_id=g.user.id, read=False).update({"read": True})
    db.session.commit()
    return jsonify(ok=True)


@bp.post("/notifications/check")
@login_required
def check_deadlines_now():
    created = run_reminder_check(current_app._get_current_object(), user_id=g.user.id)
    return jsonify(created=created)


@bp.get("/calendar.ics")
@login_required
def calendar_feed():
    entries = []
    for ue in UserEvent.query.filter_by(user_id=g.user.id).all():
        if ue.status == "skipped":
            continue
        ev = ue.event
        if ev.start_at:
            entries.append({
                "uid": f"event-{ue.id}", "title": ev.title, "start": ev.start_at, "end": ev.end_at,
                "location": ev.venue_name, "description": f"{ev.category or ''} via {ev.platform or 'direct'}. {ev.url or ''}".strip(),
                "alarm_minutes": 60,
            })
        for st in ue.stages:
            if st.due_at and not st.done:
                entries.append({
                    "uid": f"stage-{st.id}", "title": f"Deadline: {st.name} ({ev.title})", "start": st.due_at,
                    "end": st.due_at + timedelta(minutes=30), "location": None, "description": ev.url or "",
                    "alarm_minutes": 24 * 60,
                })
    return Response(build_ics(entries, f"Eventure: {g.user.name}"), mimetype="text/calendar")
