"""Google Calendar sync over the REST API (no Google client library needed).

Needs a Google Cloud OAuth client (type: Web application) with the Calendar API enabled and
GOOGLE_REDIRECT_URI added as an authorised redirect URI. Scope: calendar.events only.

What it does
  push: your events and open deadlines become Google Calendar events (tagged so we can find them again)
  pull: events already in your calendar are read so clashes with them show on your timeline
"""
import logging
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

import jwt
import requests

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
REVOKE_URL = "https://oauth2.googleapis.com/revoke"
API = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
SCOPE = "https://www.googleapis.com/auth/calendar.events"
TAG = {"eventure": "1"}
_CACHE = {}


def configured(config):
    return bool(config.get("GOOGLE_CLIENT_ID") and config.get("GOOGLE_CLIENT_SECRET"))


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ---------- OAuth ----------
def make_state(user_id, secret):
    exp = datetime.now(timezone.utc) + timedelta(minutes=10)
    return jwt.encode({"sub": str(user_id), "purpose": "google", "exp": exp}, secret, algorithm="HS256")


def read_state(state, secret):
    try:
        data = jwt.decode(state, secret, algorithms=["HS256"])
        if data.get("purpose") == "google":
            return int(data["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        pass
    return None


def build_auth_url(config, state):
    params = {
        "client_id": config["GOOGLE_CLIENT_ID"], "redirect_uri": config["GOOGLE_REDIRECT_URI"],
        "response_type": "code", "scope": SCOPE, "access_type": "offline", "prompt": "consent", "state": state,
    }
    return f"{AUTH_URL}?{urlencode(params)}"


def exchange_code(config, code):
    r = requests.post(TOKEN_URL, data={
        "code": code, "client_id": config["GOOGLE_CLIENT_ID"], "client_secret": config["GOOGLE_CLIENT_SECRET"],
        "redirect_uri": config["GOOGLE_REDIRECT_URI"], "grant_type": "authorization_code",
    }, timeout=15)
    r.raise_for_status()
    return r.json()


def valid_access_token(config, account):
    """Return a working access token, refreshing it when it is about to expire."""
    from ..extensions import db

    if account.access_token and account.expires_at and account.expires_at > _utcnow() + timedelta(seconds=60):
        return account.access_token
    r = requests.post(TOKEN_URL, data={
        "client_id": config["GOOGLE_CLIENT_ID"], "client_secret": config["GOOGLE_CLIENT_SECRET"],
        "refresh_token": account.refresh_token, "grant_type": "refresh_token",
    }, timeout=15)
    r.raise_for_status()
    data = r.json()
    account.access_token = data["access_token"]
    account.expires_at = _utcnow() + timedelta(seconds=int(data.get("expires_in", 3600)))
    db.session.commit()
    return account.access_token


# ---------- conversions (pure) ----------
def to_rfc3339(naive_local, tz):
    return naive_local.replace(tzinfo=ZoneInfo(tz)).isoformat()


def from_google(value, tz):
    """Google dateTime string -> naive local datetime. All-day entries (date only) return None."""
    if not value or len(value) <= 10:  # empty, or a bare date (all-day event)
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(ZoneInfo(tz)).replace(tzinfo=None)


def event_body(entry, tz):
    """entry: {"title", "start", "end", "location", "description", "alarm_minutes"}"""
    end = entry.get("end") or (entry["start"] + timedelta(hours=1))
    body = {
        "summary": entry["title"],
        "start": {"dateTime": entry["start"].isoformat(timespec="seconds"), "timeZone": tz},
        "end": {"dateTime": end.isoformat(timespec="seconds"), "timeZone": tz},
        "extendedProperties": {"private": TAG},
    }
    if entry.get("location"):
        body["location"] = entry["location"]
    if entry.get("description"):
        body["description"] = entry["description"]
    if entry.get("alarm_minutes"):
        body["reminders"] = {"useDefault": False, "overrides": [{"method": "popup", "minutes": int(entry["alarm_minutes"])}]}
    return body


def filter_external(items, tz):
    """Keep real, blocking, timed events that Eventure did not create."""
    out = []
    for it in items or []:
        if it.get("status") == "cancelled" or it.get("transparency") == "transparent":
            continue
        if (it.get("extendedProperties", {}).get("private", {}) or {}).get("eventure") == "1":
            continue
        start = from_google((it.get("start") or {}).get("dateTime"), tz)
        end = from_google((it.get("end") or {}).get("dateTime"), tz)
        if start and end and end > start:
            out.append({"title": it.get("summary") or "Busy", "start": start, "end": end})
    return out


# ---------- API calls ----------
def list_external_events(token, start, end, tz):
    r = requests.get(API, headers={"Authorization": f"Bearer {token}"}, params={
        "timeMin": to_rfc3339(start, tz), "timeMax": to_rfc3339(end, tz), "singleEvents": "true",
        "orderBy": "startTime", "maxResults": 250,
        "fields": "items(id,summary,status,transparency,start,end,extendedProperties/private)",
    }, timeout=15)
    r.raise_for_status()
    return filter_external(r.json().get("items"), tz)


def get_external_events(config, user_id, now):
    """Events from the student's own calendar for the next 60 days, cached for 5 minutes."""
    from ..models import GoogleAccount

    if not configured(config):
        return []
    hit = _CACHE.get(user_id)
    if hit and time.time() - hit[0] < 300:
        return hit[1]
    account = GoogleAccount.query.filter_by(user_id=user_id).first()
    if not account:
        return []
    try:
        token = valid_access_token(config, account)
        events = list_external_events(token, now, now + timedelta(days=60), config["TIMEZONE"])
    except Exception as exc:
        logging.warning("Could not read Google Calendar: %s", exc)
        return hit[1] if hit else []
    _CACHE[user_id] = (time.time(), events)
    return events


def clear_cache(user_id):
    _CACHE.pop(user_id, None)


def sync_user(config, user_id):
    """Push the student's events and open deadlines to Google Calendar. Call inside an app context."""
    from datetime import datetime as dt

    from ..extensions import db
    from ..models import GoogleAccount, SyncedItem, UserEvent

    tz = config["TIMEZONE"]
    account = GoogleAccount.query.filter_by(user_id=user_id).first()
    if not account:
        raise ValueError("Google Calendar is not connected.")
    headers = {"Authorization": f"Bearer {valid_access_token(config, account)}"}
    now_local = dt.now()

    desired = {}
    for ue in UserEvent.query.filter_by(user_id=user_id).all():
        if ue.status == "skipped":
            continue
        ev = ue.event
        if ev.start_at:
            desired[("event", ue.id)] = {
                "title": ev.title, "start": ev.start_at, "end": ev.end_at, "location": ev.venue_name,
                "description": f"{ev.category or 'Event'} via {ev.platform or 'direct'}. {ev.url or ''}".strip(),
                "alarm_minutes": 60,
            }
        for st in ue.stages:
            if st.due_at and not st.done and st.due_at >= now_local - timedelta(days=1):
                desired[("stage", st.id)] = {
                    "title": f"Deadline: {st.name} ({ev.title})", "start": st.due_at,
                    "end": st.due_at + timedelta(minutes=30), "description": ev.url or "", "alarm_minutes": 24 * 60,
                }

    existing = {(s.kind, s.ref_id): s for s in SyncedItem.query.filter_by(user_id=user_id).all()}
    counts = {"created": 0, "updated": 0, "deleted": 0, "failed": 0}

    for key, entry in desired.items():
        body, row = event_body(entry, tz), existing.get(key)
        try:
            if row:
                r = requests.patch(f"{API}/{row.google_event_id}", json=body, headers=headers, timeout=15)
                if r.status_code in (404, 410):  # removed in Google by the student: put it back
                    r = requests.post(API, json=body, headers=headers, timeout=15)
                    r.raise_for_status()
                    row.google_event_id = r.json()["id"]
                    counts["created"] += 1
                else:
                    r.raise_for_status()
                    counts["updated"] += 1
            else:
                r = requests.post(API, json=body, headers=headers, timeout=15)
                r.raise_for_status()
                db.session.add(SyncedItem(user_id=user_id, kind=key[0], ref_id=key[1], google_event_id=r.json()["id"]))
                counts["created"] += 1
        except Exception as exc:
            logging.warning("Calendar push failed for %s: %s", key, exc)
            counts["failed"] += 1

    for key, row in existing.items():
        if key in desired:
            continue
        try:
            r = requests.delete(f"{API}/{row.google_event_id}", headers=headers, timeout=15)
            if r.status_code in (200, 204, 404, 410):
                db.session.delete(row)
                counts["deleted"] += 1
            else:
                counts["failed"] += 1
        except Exception as exc:
            logging.warning("Calendar delete failed for %s: %s", key, exc)
            counts["failed"] += 1

    account.last_sync = now_local
    db.session.commit()
    clear_cache(user_id)
    return counts


def disconnect(config, user_id):
    """Remove the events we created, revoke access and forget the tokens."""
    from ..extensions import db
    from ..models import GoogleAccount, SyncedItem

    account = GoogleAccount.query.filter_by(user_id=user_id).first()
    if not account:
        return
    try:
        headers = {"Authorization": f"Bearer {valid_access_token(config, account)}"}
        for row in SyncedItem.query.filter_by(user_id=user_id).all():
            try:
                requests.delete(f"{API}/{row.google_event_id}", headers=headers, timeout=10)
            except Exception:
                pass
        requests.post(REVOKE_URL, data={"token": account.refresh_token}, timeout=10)
    except Exception as exc:
        logging.warning("Google disconnect cleanup incomplete: %s", exc)
    SyncedItem.query.filter_by(user_id=user_id).delete()
    db.session.delete(account)
    db.session.commit()
    clear_cache(user_id)
