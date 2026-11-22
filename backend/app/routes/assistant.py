"""Routes for the Sarvam AI Voice & Chat Bot and Top Portal >70% Match Engine."""
from flask import Blueprint, current_app, g, jsonify, request

from ..auth import login_required
from ..extensions import db
from ..models import Event, Stage, UserEvent
from ..services.assistant import process_assistant_message
from ..services.extraction import extract_event
from ..services.ocr import image_to_text
from ..services.portal_search import compute_match_score, search_portal_catalog
from ..services.sarvam_ai import ocr_with_sarvam, translate_many_with_sarvam
from ..languages import LANGUAGES, SUPPORTED_LANGUAGE_CODES
from ..ratelimit import Limiter, rate_limited
from ..utils import ApiError, now, parse_dt

UI_TRANSLATE_LIMIT = Limiter(180, 60)

bp = Blueprint("assistant", __name__, url_prefix="/api")


@bp.post("/assistant/chat")
@login_required
def assistant_chat():
    """Floating AI assistant endpoint (Gemini LLM Network + Sarvam Saaras v4)."""
    d = request.get_json(silent=True) or {}
    message = (d.get("message") or "").strip()
    screen = (d.get("screen") or "/").strip()
    if not message:
        raise ApiError("Message cannot be empty.")

    resp = process_assistant_message(g.user, message, current_app.config, screen)
    return jsonify(resp)


@bp.post("/translate/ui")
@rate_limited(UI_TRANSLATE_LIMIT)
def translate_ui():
    """Translate visible interface strings into the user's selected language."""
    d = request.get_json(silent=True) or {}
    target = (d.get("target_language") or "en").strip()
    if target == "en":
        target = "en-IN"
    if target not in SUPPORTED_LANGUAGE_CODES and target != "en-IN":
        raise ApiError("That language is not supported.")

    texts = d.get("texts")
    if not isinstance(texts, list) or not texts or len(texts) > 18:
        raise ApiError("Send between 1 and 18 interface strings per translation request.")
    if any(not isinstance(item, str) or len(item) > 350 for item in texts):
        raise ApiError("Each interface string must be plain text up to 350 characters.")

    if target == "en-IN":
        return jsonify(translations=texts, language=target, translated=False)

    sarvam_key = current_app.config.get("SARVAM_API_KEY") or ""
    gemini_key = current_app.config.get("GEMINI_API_KEY") or ""

    if sarvam_key:
        translated = translate_many_with_sarvam(
            texts,
            target,
            sarvam_key,
            source_lang="en-IN",
            model=current_app.config.get("SARVAM_TRANSLATE_MODEL", "sarvam-translate:v1"),
        )
        provider = "sarvam"
    elif gemini_key:
        from ..services.gemini import translate_many_with_gemini
        language_name = LANGUAGES.get(target, {}).get("name", target)
        translated = translate_many_with_gemini(
            texts,
            language_name,
            gemini_key,
            model=current_app.config.get("GEMINI_MODEL", "gemini-3.8-flash"),
        )
        provider = "gemini"
    else:
        raise ApiError(
            "Add SARVAM_API_KEY or GEMINI_API_KEY to the Render backend to translate the site.",
            503,
        )

    return jsonify(translations=translated, language=target, translated=True, provider=provider)


@bp.post("/assistant/review-submission")
@login_required
def review_submission():
    """Gemini-powered evaluation for Hackathon Vault submissions (repo, deck, video, checklist)."""
    d = request.get_json(silent=True) or {}
    vault_data = d.get("vault") or {}
    event_title = d.get("event_title") or "Hackathon"
    from ..services.gemini import review_hackathon_submission
    api_key = current_app.config.get("GEMINI_API_KEY")
    result = review_hackathon_submission(vault_data, event_title, api_key)
    return jsonify(result)


@bp.post("/search-match")
@login_required
def search_match():
    """Searches premier portals (Unstop, Devfolio, Luma) for matches.
    
    If match >= 70%: Highlights high confidence and optionally auto-adds to user timeline.
    If multiple/conflicting matches: Emits user choice cards for student confirmation.
    """
    text = ""
    upload = request.files.get("image")
    if upload:
        img_bytes = upload.read()
        sarvam_key = current_app.config.get("SARVAM_API_KEY")
        if sarvam_key:
            try:
                text = ocr_with_sarvam(img_bytes, sarvam_key)
            except Exception:
                pass
        if not text:
            try:
                text = image_to_text(img_bytes)
            except Exception:
                pass

    user_text = request.form.get("text") or (request.get_json(silent=True) or {}).get("text") or ""
    auto_add = request.form.get("auto_add", "").lower() in ("1", "true") or bool((request.get_json(silent=True) or {}).get("auto_add"))
    combined_query = f"{text}\n{user_text}".strip()
    if not combined_query:
        raise ApiError("Enter search text or upload an event flyer.")

    candidates = search_portal_catalog(combined_query, min_score=35.0)
    if not candidates:
        return jsonify(
            matched=False,
            high_confidence=False,
            match_score=0.0,
            candidates=[],
            choice_cards=[],
            message="No close matches found on top portals. You can manually enter this notice.",
        )

    best = candidates[0]
    high_confidence = best["match_score"] >= 70.0
    auto_added = False
    added_user_event_id = None

    if high_confidence and auto_add:
        # Check if already on user's timeline
        existing_ue = (
            UserEvent.query.join(Event, UserEvent.event_id == Event.id)
            .filter(UserEvent.user_id == g.user.id, Event.title == best["title"])
            .first()
        )
        if not existing_ue:
            # Create Event and UserEvent
            ev = Event(
                title=best["title"],
                platform=best.get("platform"),
                category=best.get("category", "hackathon"),
                venue_name=best.get("venue_name"),
                lat=best.get("lat"),
                lng=best.get("lng"),
                start_at=parse_dt(best.get("start_at")),
                end_at=parse_dt(best.get("end_at")),
                registration_deadline=parse_dt(best.get("registration_deadline")),
                url=best.get("url"),
                description=best.get("description", ""),
                is_public=True,
                created_by=g.user.id,
            )
            db.session.add(ev)
            db.session.flush()

            ue = UserEvent(user_id=g.user.id, event_id=ev.id, status="registered")
            db.session.add(ue)
            db.session.flush()

            for st in best.get("stages", []):
                db.session.add(Stage(user_event_id=ue.id, name=st["name"], due_at=parse_dt(st.get("due_at"))))

            db.session.commit()
            auto_added = True
            added_user_event_id = ue.id

    return jsonify(
        matched=True,
        high_confidence=high_confidence,
        match_score=best["match_score"],
        best_match=best,
        auto_added=auto_added,
        added_user_event_id=added_user_event_id,
        choice_cards=candidates[:3],
        message=f"{'✨ High-Confidence (>70%)' if high_confidence else 'Found'} match on {best['platform']}: {best['title']}",
    )
