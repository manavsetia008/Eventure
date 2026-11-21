"""Escalating deadline reminders. Only fires when a deadline is actually at risk."""
import logging
import smtplib
from datetime import timedelta
from email.message import EmailMessage

LEVEL_ORDER = ["warning", "urgent", "critical"]


def level_for(hours_left):
    if hours_left < -24:
        return None
    if hours_left <= 6:
        return "critical"
    if hours_left <= 24:
        return "urgent"
    if hours_left <= 48:
        return "warning"
    return None


def _human(hours_left):
    if hours_left < 0:
        return "is overdue"
    if hours_left < 1:
        return "is due within the hour"
    if hours_left < 24:
        return f"is due in {int(hours_left)} h"
    return f"is due in {int(hours_left // 24)} day" + ("s" if hours_left >= 48 else "")


def compute_reminders(stages, now):
    """stages: [{"id", "user_id", "event_title", "name", "due_at", "done", "status", "priority_allowed"}] -> reminder dicts.
    
    Priority-gated: alerts are strictly limited to Registered and Keep-threshold events to save API costs.
    """
    out = []
    for s in stages:
        if s["done"] or not s["due_at"] or s.get("status") in ("skipped", "attended"):
            continue
        # If explicitly gated out by priority scoring, suppress alert
        if s.get("priority_allowed") is False:
            continue
        hours_left = (s["due_at"] - now).total_seconds() / 3600
        level = level_for(hours_left)
        if not level:
            continue
        key = f"stage:{s['id']}:" + ("overdue" if hours_left < 0 else level)
        prefix = {"warning": "Heads up", "urgent": "Urgent", "critical": "Act now"}[level]
        out.append({
            "user_id": s["user_id"],
            "key": key,
            "level": level,
            "message": f"{prefix}: {s['name']} for {s['event_title']} {_human(hours_left)}.",
        })
    return out


def send_email(config, to_address, subject, body):
    if not config.get("SMTP_HOST"):
        return False
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = config["SMTP_FROM"], to_address, subject
    msg.set_content(body)
    try:
        with smtplib.SMTP(config["SMTP_HOST"], config["SMTP_PORT"], timeout=10) as smtp:
            smtp.starttls()
            if config.get("SMTP_USER"):
                smtp.login(config["SMTP_USER"], config["SMTP_PASSWORD"])
            smtp.send_message(msg)
        return True
    except Exception as exc:
        logging.warning("Email reminder failed: %s", exc)
        return False


def run_reminder_check(app, user_id=None):
    """Create in-app notifications (and optional emails) for at-risk deadlines. Returns how many were created."""
    from sqlalchemy.exc import IntegrityError

    from ..extensions import db
    from ..models import Notification, Stage, TopPriorityCall, User, UserEvent
    from ..services.priority import score_item
    from ..utils import now as now_fn

    created = 0
    with app.app_context():
        now = now_fn()
        window_end = now + timedelta(hours=49)
        query = (
            db.session.query(Stage, UserEvent, User)
            .join(UserEvent, Stage.user_event_id == UserEvent.id)
            .join(User, UserEvent.user_id == User.id)
            .filter(Stage.done.is_(False), Stage.due_at.isnot(None), Stage.due_at <= window_end, Stage.due_at >= now - timedelta(hours=25))
        )
        if user_id:
            query = query.filter(UserEvent.user_id == user_id)

        rows = []
        for st, ue, u in query.all():
            priority_allowed = True
            if ue.status in ("skipped", "attended"):
                priority_allowed = False
            elif ue.status == "registered":
                priority_allowed = True
            elif ue.status == "interested":
                threshold = u.threshold_keep if u.threshold_keep is not None else 55
                score = getattr(ue, "custom_score", None)
                if score is not None:
                    priority_allowed = (score >= threshold)
                else:
                    item_dict = {
                        "title": ue.event.title,
                        "category": ue.event.category,
                        "description": ue.event.description,
                        "status": ue.status,
                    }
                    fit = score_item(item_dict, u.goals_list, now, u.scoring_mode or "balanced")
                    priority_allowed = (fit["score"] >= threshold)

            rows.append({
                "id": st.id,
                "user_id": ue.user_id,
                "event_title": ue.event.title,
                "name": st.name,
                "due_at": st.due_at,
                "done": st.done,
                "status": ue.status,
                "priority_allowed": priority_allowed,
            })
        for r in compute_reminders(rows, now):
            exists = Notification.query.filter_by(user_id=r["user_id"], dedupe_key=r["key"]).first()
            if exists:
                continue
            db.session.add(Notification(user_id=r["user_id"], message=r["message"], level=r["level"], dedupe_key=r["key"]))
            try:
                db.session.commit()
            except IntegrityError:  # another worker created it first
                db.session.rollback()
                continue
            created += 1
            user = db.session.get(User, r["user_id"])
            if user:
                send_email(app.config, user.email, "Eventure reminder", r["message"])
                from .push import push_to_user

                push_to_user(app.config, user.id, "Eventure", r["message"], "/")

        # ── 24-Hour Voice Call Check for Top-Priority Events ──
        pending_calls = TopPriorityCall.query.filter(
            TopPriorityCall.status == "scheduled",
            TopPriorityCall.scheduled_call_at <= now,
        ).all()
        for call_rec in pending_calls:
            try:
                from .sarvam_ai import trigger_sarvam_voice_call
                u = db.session.get(User, call_rec.user_id)
                lang = getattr(u, "primary_language", "hi-IN") or "hi-IN"
                call_res = trigger_sarvam_voice_call(
                    phone=call_rec.phone_number,
                    event_title=call_rec.event.title if call_rec.event else "Top Priority Event",
                    deadline_str=str(call_rec.latest_deadline),
                    api_key=app.config.get("SARVAM_API_KEY", ""),
                    lang=lang,
                )
                call_rec.status = "completed"
                call_rec.call_log = f"Automated voice call placed at {now.isoformat()}: {call_res.get('status')}"
                alert_msg = f"📞 24h Sarvam Voice Alert placed for your top-priority event '{call_rec.event.title if call_rec.event else 'Event'}'. Deadline: {call_rec.latest_deadline}."
                db.session.add(Notification(
                    user_id=call_rec.user_id,
                    message=alert_msg,
                    level="urgent",
                    dedupe_key=f"top-call:{call_rec.id}:{call_rec.latest_deadline}",
                ))
                created += 1
            except Exception as e:
                call_rec.status = "failed"
                call_rec.call_log = f"Failed at {now.isoformat()}: {str(e)}"
        db.session.commit()
    return created
