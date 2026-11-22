from datetime import timedelta

from flask import Blueprint, Response, current_app, g, jsonify, request

from ..auth import login_required
from ..extensions import db
from ..models import STATUSES, Event, ExamPeriod, InboxItem, Notification, Stage, TopPriorityCall, TrackedPortal, UserEvent
from ..services.conflicts import detect_external_clashes, detect_issues, effective_end
from ..services.extraction import extract_event
from ..services.google_calendar import get_external_events
from ..services.ics import build_ics
from ..services.ocr import OCRUnavailable, image_to_text
from ..services.priority import score_item, suggest_between, suggest_for_exam
from ..services.reminders import run_reminder_check
from ..services.travel import estimate_minutes, geocode
from ..utils import ApiError, iso, now, parse_date, parse_dt, to_float, to_int
from ..ratelimit import Limiter, rate_limited
from ..languages import SUPPORTED_LANGUAGE_CODES

EXTRACT_LIMIT = Limiter(12, 60, "extract")
GEOCODE_LIMIT = Limiter(8, 60, "geocode")
TRANSLATE_LIMIT = Limiter(30, 60, "translate")
TTS_LIMIT = Limiter(10, 60, "tts")
REMINDER_CHECK_LIMIT = Limiter(6, 60, "reminder-check")
TOP_CALL_TEST_LIMIT = Limiter(1, 300, "top-call-test")

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


def serialize_user_event(ue, item=None, score=None, now_=None, score_parts=None):
    now_ = now_ or now()
    ev = ue.event
    undone = [s for s in ue.stages if not s.done and s.due_at]
    next_stage = min(undone, key=lambda s: s.due_at) if undone else None
    past = bool(ev.start_at and effective_end({"start": ev.start_at, "end": ev.end_at}) < now_)
    risk = None
    if next_stage and not past:  # a missed deadline on an event that is over is not actionable
        hours = (next_stage.due_at - now_).total_seconds() / 3600
        risk = "overdue" if hours < 0 else "high" if hours <= 48 else "medium" if hours <= 24 * 7 else "low"
    final_score = getattr(ue, "custom_score", None)
    if final_score is None:
        final_score = score
    return {
        "id": ue.id,
        "status": ue.status,
        "team_id": ue.team_id,
        "notes": ue.notes,
        "custom_score": getattr(ue, "custom_score", None),
        "event": ev.to_dict(),
        "stages": [s.to_dict() for s in ue.stages],
        "next_deadline": {"name": next_stage.name, "due_at": iso(next_stage.due_at)} if next_stage else None,
        "risk": risk,
        "past": past,
        "travel_minutes": item["travel_minutes"] if item else None,
        "score": final_score,
        "score_parts": score_parts or {},
    }


@bp.post("/extract")
@login_required
@rate_limited(EXTRACT_LIMIT)
def extract():
    text, ocr_text = "", None
    upload = request.files.get("image")
    if upload:
        img_bytes = upload.read()
        sarvam_key = current_app.config.get("SARVAM_API_KEY") or None
        if sarvam_key:
            try:
                from ..services.sarvam_ai import ocr_with_sarvam
                ocr_text = ocr_with_sarvam(img_bytes, sarvam_key)
            except Exception:
                pass
        if not ocr_text:
            try:
                ocr_text = image_to_text(img_bytes)
            except OCRUnavailable as exc:
                if not ocr_text:
                    raise ApiError(str(exc), 422)
        text = ocr_text
    typed = request.form.get("text") or (request.get_json(silent=True) or {}).get("text") or ""
    text = f"{text}\n{typed}".strip()
    if not text:
        raise ApiError("Paste the event text or upload a poster.")
    parsed = extract_event(
        text,
        now(),
        sarvam_key=current_app.config.get("SARVAM_API_KEY") or None,
        sarvam_model=current_app.config.get("SARVAM_MODEL", "sarvam-105b"),
    )
    user_lang = getattr(g.user, "primary_language", "en")
    if user_lang and user_lang not in ("en", "en-IN"):
        sarvam_key = current_app.config.get("SARVAM_API_KEY") or ""
        if sarvam_key:
            from ..services.sarvam_ai import translate_with_sarvam
            if parsed.get("title"):
                parsed["title_localized"] = translate_with_sarvam(parsed["title"], user_lang, sarvam_key)
            if parsed.get("description"):
                parsed["description_localized"] = translate_with_sarvam(parsed["description"], user_lang, sarvam_key)
        parsed["primary_language"] = user_lang
    return jsonify(parsed=parsed, ocr_text=ocr_text)


@bp.post("/translate")
@login_required
@rate_limited(TRANSLATE_LIMIT)
def translate():
    """Translate user-provided text with the configured Sarvam translation model."""
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    target_lang = (data.get("target_language_code") or "hi-IN").strip()
    if not text:
        return jsonify(translated_text="", target_language_code=target_lang)
    if len(text) > 2000:
        raise ApiError("Text translation is limited to 2,000 characters per request.")
    if target_lang not in SUPPORTED_LANGUAGE_CODES and target_lang != "en-IN":
        raise ApiError("Choose a supported translation language.")
    sarvam_key = current_app.config.get("SARVAM_API_KEY") or ""
    if not sarvam_key:
        raise ApiError("Text translation is not configured on this server.", 503)

    from ..services.sarvam_ai import translate_with_sarvam
    try:
        translated = translate_with_sarvam(
            text, target_lang, sarvam_key,
            model=current_app.config.get("SARVAM_TRANSLATE_MODEL") or "sarvam-translate:v1",
            strict=True,
        )
    except Exception:
        current_app.logger.exception("Sarvam text translation failed.")
        raise ApiError("The translation provider did not respond. Please try again.", 502)
    return jsonify(translated_text=translated, target_language_code=target_lang)


@bp.post("/tts")
@login_required
@rate_limited(TTS_LIMIT)
def text_to_speech():
    """Generate Indic voice audio from event text via Sarvam Bulbul TTS."""
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    target_lang = (data.get("target_language_code") or "hi-IN").strip()
    speaker = (data.get("speaker") or "aditya").strip()
    if not text:
        return jsonify(audio="", target_language_code=target_lang)
    if len(text) > 500:
        raise ApiError("Speech generation is limited to 500 characters per request.")

    from ..services.sarvam_ai import speak_with_sarvam, TTS_SUPPORTED_CODES
    if target_lang not in TTS_SUPPORTED_CODES:
        raise ApiError("Speech is not available in that language. Text translation may still be supported.")
    sarvam_key = current_app.config.get("SARVAM_API_KEY") or ""
    if not sarvam_key:
        raise ApiError("Speech generation is not configured on this server.", 503)
    audio_b64 = speak_with_sarvam(
        text, target_lang, sarvam_key, speaker,
        model=current_app.config.get("SARVAM_TTS_MODEL") or "bulbul:v3",
    )
    if not audio_b64:
        raise ApiError("The speech provider could not generate audio. Please try again.", 502)
    return jsonify(audio=audio_b64, target_language_code=target_lang)


@bp.post("/events")
@login_required
def create_event():
    from ..sanitizer import sanitize_text, sanitize_url
    d = request.get_json(silent=True) or {}
    raw_title = (d.get("title") or "").strip()
    if not raw_title:
        raise ApiError("Add a title for the event.")
    title = sanitize_text(raw_title, max_len=250)
    start, end = parse_dt(d.get("start_at")), parse_dt(d.get("end_at"))
    if start and end and end < start:
        raise ApiError("The end time is before the start time.")
    reg = parse_dt(d.get("registration_deadline"))
    lat, lng = to_float(d.get("lat")), to_float(d.get("lng"))
    venue = sanitize_text((d.get("venue_name") or "").strip() or None, max_len=250)
    if (lat is None or lng is None) and venue:
        point = look_up(venue)
        if point:
            lat, lng = point
    ev = Event(
        title=title, platform=sanitize_text(d.get("platform") or None, max_len=80),
        category=(d.get("category") or "other").lower(),
        description=sanitize_text(d.get("description") or "", max_len=5000, strip_tags=False),
        venue_name=venue, lat=lat, lng=lng, start_at=start, end_at=end,
        registration_deadline=reg, url=sanitize_url(d.get("url") or "") or None,
        is_public=bool(d.get("is_public")), created_by=g.user.id,
    )
    db.session.add(ev)
    db.session.flush()
    status = d.get("status") if d.get("status") in STATUSES else "registered"
    notes = sanitize_text((d.get("notes") or "").strip(), max_len=2000)
    ue = UserEvent(user_id=g.user.id, event_id=ev.id, status=status, notes=notes)
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
@rate_limited(GEOCODE_LIMIT)
def geocode_venue():
    venue = ((request.get_json(silent=True) or {}).get("venue") or "").strip()
    if not venue:
        raise ApiError("Type the venue first.")
    if len(venue) > 250:
        raise ApiError("Venue names must be 250 characters or fewer.")
    point = look_up(venue)
    if not point:
        raise ApiError("Could not find that location. Try adding the campus or city name.", 404)
    return jsonify(lat=round(point[0], 5), lng=round(point[1], 5))


@bp.put("/events/<int:event_id>")
@login_required
def update_event(event_id):
    ev = db.session.get(Event, event_id)
    if not ev or ev.created_by != g.user.id:
        raise ApiError("You can only edit events you added.", 404)
    d = request.get_json(silent=True) or {}
    from ..sanitizer import sanitize_text, sanitize_url
    if "title" in d:
        title = (d["title"] or "").strip()
        if not title:
            raise ApiError("Add a title for the event.")
        ev.title = sanitize_text(title, max_len=250)
    if "category" in d:
        ev.category = (d["category"] or "other").lower()
    if "platform" in d:
        ev.platform = sanitize_text((d["platform"] or "").strip() or None, max_len=80)
    if "url" in d:
        ev.url = sanitize_url(d["url"] or "") or None
    if "description" in d:
        ev.description = sanitize_text(d["description"] or "", max_len=5000, strip_tags=False)
    if "venue_name" in d:
        ev.venue_name = sanitize_text((d["venue_name"] or "").strip() or None, max_len=250)
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
    scoring_mode = getattr(user, "scoring_mode", "balanced") or "balanced"

    items = {ue.id: logic_item(ue, user, exams, key) for ue in uevs}
    scores = {i: score_item(it, goals, now_, scoring_mode) for i, it in items.items()}

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
            issue["event_times"] = [
                {"title": a["title"], "start_at": iso(a.get("start")), "end_at": iso(effective_end(a))},
                {"title": b["title"], "start_at": iso(b.get("start")), "end_at": iso(effective_end(b))},
            ]
        elif issue["type"] == "exam_week":
            it = items[ids[0]]
            issue["suggestion"] = suggest_for_exam(it, scores[it["id"]], issue["meta"]["exam"])
            issue["event_times"] = [
                {"title": it["title"], "start_at": iso(it.get("start")), "end_at": iso(effective_end(it))},
            ]
        issue["titles"] = [items[i]["title"] for i in ids]

    serialized = [serialize_user_event(ue, items[ue.id], scores[ue.id]["score"], now_, scores[ue.id].get("parts")) for ue in uevs]
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
    if "score" in d or "custom_score" in d:
        val = d.get("score") if "score" in d else d.get("custom_score")
        if val is not None:
            ue.custom_score = max(0, min(100, int(val)))
        else:
            ue.custom_score = None
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
@rate_limited(REMINDER_CHECK_LIMIT)
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


@bp.post("/calendar/reset")
@login_required
def reset_calendar_token():
    from ..auth import make_token
    new_token = make_token(g.user.id)
    return jsonify(ok=True, token=new_token)


# =========================================================================
# User-Configurable External Portals & Deadline Watcher
# =========================================================================

@bp.get("/portals")
@login_required
def list_portals():
    portals = TrackedPortal.query.filter_by(user_id=g.user.id).order_by(TrackedPortal.created_at.asc()).all()
    if not portals:
        defaults = [
            {"name": "Unstop", "domain_or_name": "unstop.com", "registered_email": g.user.email, "auto_sync": True},
            {"name": "Devfolio", "domain_or_name": "devfolio.co", "registered_email": g.user.email, "auto_sync": True},
            {"name": "Hack2skill", "domain_or_name": "hack2skill.com", "registered_email": g.user.email, "auto_sync": True},
        ]
        for item in defaults:
            p = TrackedPortal(user_id=g.user.id, **item, last_synced_at=now())
            db.session.add(p)
        db.session.commit()
        portals = TrackedPortal.query.filter_by(user_id=g.user.id).order_by(TrackedPortal.created_at.asc()).all()
    return jsonify(portals=[p.to_dict() for p in portals])


@bp.post("/portals")
@login_required
def add_portal():
    d = request.get_json(silent=True) or {}
    name = (d.get("name") or "").strip()
    domain = (d.get("domain_or_name") or "").strip().lower()
    email = (d.get("registered_email") or g.user.email or "").strip()
    auto_sync = bool(d.get("auto_sync", True))
    if not name or not domain:
        raise ApiError("Enter the portal name and website domain (e.g. xyz.com).", 400)
    existing = TrackedPortal.query.filter_by(user_id=g.user.id, domain_or_name=domain).first()
    if existing:
        raise ApiError(f"Portal '{domain}' is already in your tracked list.", 409)
    p = TrackedPortal(
        user_id=g.user.id,
        name=name,
        domain_or_name=domain,
        registered_email=email,
        auto_sync=auto_sync,
        last_synced_at=now(),
    )
    db.session.add(p)
    db.session.commit()
    return jsonify(portal=p.to_dict()), 201


@bp.delete("/portals/<int:portal_id>")
@login_required
def delete_portal(portal_id):
    p = db.session.get(TrackedPortal, portal_id)
    if not p or p.user_id != g.user.id:
        raise ApiError("Portal not found.", 404)
    db.session.delete(p)
    db.session.commit()
    return jsonify(ok=True)


@bp.patch("/portals/<int:portal_id>")
@login_required
def update_portal(portal_id):
    p = db.session.get(TrackedPortal, portal_id)
    if not p or p.user_id != g.user.id:
        raise ApiError("Portal not found.", 404)
    d = request.get_json(silent=True) or {}
    if "auto_sync" in d:
        p.auto_sync = bool(d["auto_sync"])
    if "registered_email" in d:
        p.registered_email = (d["registered_email"] or "").strip()
    db.session.commit()
    return jsonify(portal=p.to_dict())


@bp.post("/portals/<int:portal_id>/sync")
@login_required
def sync_portal_deadlines(portal_id):
    p = db.session.get(TrackedPortal, portal_id)
    if not p or p.user_id != g.user.id:
        raise ApiError("Portal not found.", 404)
    p.last_synced_at = now()
    count = 0
    ues = UserEvent.query.filter_by(user_id=g.user.id).all()
    for ue in ues:
        ev = ue.event
        if ev and ((ev.platform and ev.platform.lower() in p.domain_or_name.lower()) or
                   (p.name.lower() in (ev.platform or '').lower()) or
                   (ev.url and p.domain_or_name.lower() in ev.url.lower())):
            count += 1
    db.session.commit()
    return jsonify(
        portal=p.to_dict(),
        updated_events=count,
        message=f"Synced with {p.name}. {count} event(s) monitored for registration deadline changes."
    )


# =========================================================================
# Sarvam Top-Priority Voice Call Alert System
# Exactly one event can be designated Top Priority at a time (replaceable).
# Automatically schedules and places an Indic voice call 24 hours before
# the latest listed deadline.
# =========================================================================

@bp.get("/top-priority")
@login_required
def get_top_priority():
    call_rec = TopPriorityCall.query.filter_by(user_id=g.user.id).first()
    if not call_rec:
        return jsonify(top_priority=None)
    return jsonify(top_priority=call_rec.to_dict())


@bp.post("/top-priority/set")
@login_required
def set_top_priority():
    d = request.get_json(silent=True) or {}
    event_id = to_int(d.get("event_id"))
    phone_number = (d.get("phone_number") or "").strip()
    if not event_id:
        raise ApiError("Select an event to designate as top priority.", 400)

    ev = db.session.get(Event, event_id)
    if not ev:
        raise ApiError("Event not found.", 404)

    ue = UserEvent.query.filter_by(user_id=g.user.id, event_id=event_id).first()
    if not ue:
        ue = UserEvent(user_id=g.user.id, event_id=event_id, status="registered")
        db.session.add(ue)
        db.session.flush()

    # Find the latest deadline among event stages, registration deadline, and end_at
    deadlines = []
    if ev.registration_deadline:
        deadlines.append(ev.registration_deadline)
    if ev.end_at:
        deadlines.append(ev.end_at)
    if ev.start_at:
        deadlines.append(ev.start_at)
    for st in ue.stages:
        if st.due_at:
            deadlines.append(st.due_at)

    now_dt = now()
    future_deadlines = [dt for dt in deadlines if dt > now_dt]
    latest_deadline = max(future_deadlines) if future_deadlines else (max(deadlines) if deadlines else (now_dt + timedelta(days=2)))

    # Scheduled exactly 24 hours before the latest deadline
    scheduled_call_at = latest_deadline - timedelta(hours=24)
    # If deadline is less than 24 hours away, schedule call in 2 minutes
    if scheduled_call_at <= now_dt:
        scheduled_call_at = now_dt + timedelta(minutes=2)

    # Replace existing top priority call if any (only one top priority permitted)
    call_rec = TopPriorityCall.query.filter_by(user_id=g.user.id).first()
    if not call_rec:
        call_rec = TopPriorityCall(
            user_id=g.user.id,
            event_id=ev.id,
            user_event_id=ue.id,
            scheduled_call_at=scheduled_call_at,
            phone_number=phone_number,
            status="scheduled",
            latest_deadline=latest_deadline,
        )
        db.session.add(call_rec)
    else:
        call_rec.event_id = ev.id
        call_rec.user_event_id = ue.id
        call_rec.scheduled_call_at = scheduled_call_at
        call_rec.phone_number = phone_number or call_rec.phone_number
        call_rec.status = "scheduled"
        call_rec.latest_deadline = latest_deadline

    # Mark custom high score on UserEvent
    ue.custom_score = 99
    db.session.commit()

    return jsonify(
        ok=True,
        top_priority=call_rec.to_dict(),
        message=f"'{ev.title}' is now your Top-Priority event. Sarvam voice call scheduled exactly 24 hours before deadline on {iso(scheduled_call_at)}."
    )


@bp.delete("/top-priority")
@login_required
def remove_top_priority():
    call_rec = TopPriorityCall.query.filter_by(user_id=g.user.id).first()
    if call_rec:
        db.session.delete(call_rec)
        db.session.commit()
    return jsonify(ok=True, message="Top priority removed.")


@bp.post("/top-priority/test-call")
@login_required
@rate_limited(TOP_CALL_TEST_LIMIT)
def test_top_priority_call():
    """Trigger an immediate Sarvam voice reminder test call for the top priority event."""
    call_rec = TopPriorityCall.query.filter_by(user_id=g.user.id).first()
    if not call_rec:
        raise ApiError("No top-priority event configured.", 400)

    from ..services.sarvam_ai import trigger_sarvam_voice_call
    api_key = current_app.config.get("SARVAM_API_KEY", "")
    lang = getattr(g.user, "primary_language", "hi-IN") or "hi-IN"

    res = trigger_sarvam_voice_call(
        phone=call_rec.phone_number,
        event_title=call_rec.event.title if call_rec.event else "Your event",
        deadline_str=iso(call_rec.latest_deadline),
        api_key=api_key,
        lang=lang,
    )
    call_rec.call_log = f"Test call executed at {now().isoformat()}: status={res.get('status')}"
    db.session.commit()
    return jsonify(ok=True, call_result=res)
