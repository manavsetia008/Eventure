"""Sarvam Voice & Chat Bot Assistant Service (Sarvam Saaras v4 + 105B).

Provides intelligent event assistant capabilities:
1. Search events ("find hackathons this weekend")
2. Check clashes & exam conflicts ("any clashes with my midsems?")
3. Screen navigation ("take me to settings", "open discover")
4. Quick event creation ("add TechFest on Nov 28 at Audi")
5. Multi-lingual voice generation via Sarvam Bulbul / Saaras v4 TTS
"""
import logging
import re
from datetime import datetime, timedelta

from ..extensions import db
from ..models import Event, ExamPeriod, User, UserEvent
from ..services.conflicts import detect_issues
from ..services.extraction import extract_event
from ..services.sarvam_ai import speak_with_sarvam, translate_with_sarvam
from ..utils import now as now_fn

NAV_TARGETS = {
    "timeline": "/",
    "calendar": "/",
    "home": "/",
    "discover": "/discover",
    "search": "/discover",
    "explore": "/discover",
    "add": "/add",
    "create": "/add",
    "inbox": "/inbox",
    "email": "/inbox",
    "community": "/community",
    "clubs": "/community",
    "teams": "/community",
    "organizer": "/organizer",
    "notifications": "/notifications",
    "alerts": "/notifications",
    "settings": "/settings",
    "profile": "/settings",
}


def _detect_nav_intent(message: str) -> str:
    msg = message.lower()
    nav_keywords = ["go to", "open", "take me to", "navigate to", "show", "view"]
    for kw in nav_keywords:
        if kw in msg:
            for screen, path in NAV_TARGETS.items():
                if screen in msg:
                    return path
    return None


def process_assistant_message(user: User, message: str, config: dict, screen: str = "/") -> dict:
    now = now_fn()
    msg = (message or "").strip()
    msg_lower = msg.lower()

    action = None
    reply_text = ""
    suggested_chips = ["Find AI hackathons", "Check my exam clashes", "Go to Settings", "Add an event"]

    # 1. Navigation Intent
    nav_path = _detect_nav_intent(msg_lower)
    if nav_path:
        screen_name = [k for k, v in NAV_TARGETS.items() if v == nav_path][0].capitalize()
        reply_text = f"Navigating to {screen_name} for you."
        action = {"type": "navigate", "target": nav_path}
        return _format_response(reply_text, action, user.primary_language, config, suggested_chips)

    # 2. Clash & Conflict Check Intent
    if any(k in msg_lower for k in ["clash", "conflict", "overlap", "exam", "busy"]):
        ues = UserEvent.query.filter_by(user_id=user.id).all()
        exams = ExamPeriod.query.filter_by(user_id=user.id).all()
        exam_dicts = [{"label": p.label, "start": p.start_date, "end": p.end_date} for p in exams]
        event_dicts = [
            {"id": ue.id, "title": ue.event.title, "start": ue.event.start_at, "end": ue.event.end_at,
             "lat": ue.event.lat, "lng": ue.event.lng, "venue": ue.event.venue_name}
            for ue in ues if ue.event and ue.event.start_at
        ]
        issues = detect_issues(event_dicts, exam_dicts)
        if not issues:
            reply_text = f"Great news, {user.name}! You currently have zero schedule clashes or exam collisions on your timeline."
        else:
            first = issues[0]
            reply_text = f"Heads up! We detected {len(issues)} issue(s): {first['message']}"
            action = {"type": "navigate", "target": "/"}
        return _format_response(reply_text, action, user.primary_language, config, suggested_chips)

    # 3. Add Event Intent
    if msg_lower.startswith("add ") or "add event" in msg_lower or "schedule " in msg_lower:
        parsed = extract_event(msg, now, sarvam_key=config.get("SARVAM_API_KEY"))
        if parsed.get("title") and parsed["title"] != "Event":
            reply_text = f"I've drafted '{parsed['title']}' for {parsed.get('start_at') or 'your timeline'}. You can review and confirm it."
            action = {"type": "draft_event", "event": parsed}
        else:
            reply_text = "I couldn't quite extract the event title and date. Would you like to use the Add Event poster scanner?"
            action = {"type": "navigate", "target": "/add"}
        return _format_response(reply_text, action, user.primary_language, config, suggested_chips)

    # 4. Search / Discover Intent
    if any(k in msg_lower for k in ["find", "search", "show me", "hackathon", "workshop", "event"]):
        clean_q = re.sub(r"\b(find|search|show me|events?|hackathons?|workshops?|any)\b", "", msg_lower).strip()
        query = clean_q or "hackathon"
        matching = (
            Event.query.filter(Event.is_public.is_(True), Event.start_at >= now)
            .filter(Event.title.ilike(f"%{query}%") | Event.category.ilike(f"%{query}%"))
            .limit(3)
            .all()
        )
        if matching:
            titles = ", ".join(f"'{e.title}'" for e in matching)
            reply_text = f"I found {len(matching)} matching event(s): {titles}. Take a look in Discover."
            action = {"type": "navigate", "target": f"/discover?q={query}"}
        else:
            reply_text = f"No exact upcoming matches for '{query}' right now. Check Discover for all campus listings."
            action = {"type": "navigate", "target": "/discover"}
        return _format_response(reply_text, action, user.primary_language, config, suggested_chips)

    # 5. Intelligent Conversational Response (Gemini LLM Network or Sarvam Default)
    gemini_key = config.get("GEMINI_API_KEY")
    if gemini_key:
        try:
            from .gemini import generate_with_gemini
            system_prompt = (
                f"You are the Eventure AI Assistant for student {user.name} ({user.college or 'Campus'}). "
                f"The student's interests are {user.goals or 'hackathons, coding'}. "
                "Be helpful, enthusiastic, and concise (2-3 sentences max). Recommend relevant hackathon preparation tips or campus guidance."
            )
            llm_reply = generate_with_gemini(msg, gemini_key, system_prompt, model=config.get("GEMINI_MODEL", "gemini-2.0-flash"))
            if llm_reply:
                return _format_response(llm_reply, None, user.primary_language, config, suggested_chips)
        except Exception as exc:
            logging.warning("Gemini conversational generation fallback: %s", exc)

    reply_text = (
        f"Hi {user.name}! I am your Eventure AI campus assistant (powered by Gemini & Sarvam). "
        "Ask me to find hackathons, check for schedule clashes, or navigate anywhere across Eventure."
    )
    return _format_response(reply_text, None, user.primary_language, config, suggested_chips)


def _format_response(text: str, action: dict, target_lang: str, config: dict, chips: list) -> dict:
    sarvam_key = config.get("SARVAM_API_KEY") or ""
    translated_text = text

    # If user's primary language is Indic, translate assistant speech
    if target_lang and target_lang not in ("en", "en-IN") and sarvam_key:
        try:
            translated_text = translate_with_sarvam(text, target_lang, sarvam_key)
        except Exception as e:
            logging.warning("Failed translating assistant response: %s", e)

    # Voice audio synthesis
    audio_b64 = ""
    if sarvam_key:
        try:
            lang_code = target_lang if target_lang not in ("en", "") else "en-IN"
            audio_b64 = speak_with_sarvam(translated_text, lang_code, sarvam_key)
        except Exception as e:
            logging.warning("Bulbul TTS synthesis skipped: %s", e)

    return {
        "reply": translated_text,
        "original_text": text,
        "action": action,
        "audio": audio_b64,
        "chips": chips,
    }
