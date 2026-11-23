"""Routes for the Sarvam AI Voice & Chat Bot and Top Portal >70% Match Engine."""
from flask import Blueprint, current_app, g, jsonify, request
from sqlalchemy.exc import IntegrityError

from ..auth import login_required
from ..extensions import db
from ..models import Event, UserEvent
from ..services.assistant import process_assistant_message
from ..services.extraction import extract_event
from ..services.ocr import image_to_text
from ..services.portal_search import search_portal_catalog
from ..services.sarvam_ai import ocr_with_sarvam, translate_many_with_sarvam
from ..languages import LANGUAGES, SUPPORTED_LANGUAGE_CODES
from ..ratelimit import Limiter, rate_limited
from ..utils import ApiError, now

UI_TRANSLATE_LIMIT = Limiter(90, 60, "ui-translate")
AI_CHAT_LIMIT = Limiter(20, 60, "assistant-chat")
AI_REVIEW_LIMIT = Limiter(5, 60, "assistant-review")
PORTAL_MATCH_LIMIT = Limiter(10, 60, "portal-match")

bp = Blueprint("assistant", __name__, url_prefix="/api")


@bp.post("/assistant/chat")
@login_required
@rate_limited(AI_CHAT_LIMIT)
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
    """Translate visible interface strings with strict provider validation."""
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
    language_name = LANGUAGES.get(target, {}).get("name", target)
    failures = []

    if sarvam_key:
        try:
            translated = translate_many_with_sarvam(
                texts,
                target,
                sarvam_key,
                source_lang="en-IN",
                model=current_app.config.get("SARVAM_TRANSLATE_MODEL", "sarvam-translate:v1"),
                strict=True,
            )
            if len(translated) == len(texts) and all(
                isinstance(value, str) and value.strip() for value in translated
            ):
                return jsonify(translations=translated, language=target, translated=True, provider="sarvam")
            failures.append("Sarvam returned an incomplete translation.")
        except Exception as exc:
            current_app.logger.warning("Sarvam UI translation failed: %s", exc)
            failures.append("Sarvam translation failed.")

    if gemini_key:
        try:
            from ..services.gemini import translate_many_with_gemini
            translated = translate_many_with_gemini(
                texts,
                language_name,
                gemini_key,
                model=current_app.config.get("GEMINI_MODEL", "gemini-3.8-flash"),
                strict=True,
            )
            if len(translated) == len(texts) and all(
                isinstance(value, str) and value.strip() for value in translated
            ):
                return jsonify(translations=translated, language=target, translated=True, provider="gemini")
            failures.append("Gemini returned an incomplete translation.")
        except Exception as exc:
            current_app.logger.warning("Gemini UI translation failed: %s", exc)
            failures.append("Gemini translation failed.")

    if not sarvam_key and not gemini_key:
        raise ApiError(
            "Add SARVAM_API_KEY or GEMINI_API_KEY to the Render backend to translate the site.",
            503,
        )
    raise ApiError("Translation providers are unavailable. " + " ".join(failures), 502)




@bp.post("/assistant/review-submission")
@login_required
@rate_limited(AI_REVIEW_LIMIT)
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
@rate_limited(PORTAL_MATCH_LIMIT)
def search_match():
    """Match poster/text against currently fetched public listings only."""
    text = ""
    upload = request.files.get("image")
    if upload:
        img_bytes = upload.read()
        if len(img_bytes) > current_app.config.get("MAX_CONTENT_LENGTH", 8 * 1024 * 1024):
            raise ApiError("Upload a poster smaller than 8 MB.", 413)
        sarvam_key = current_app.config.get("SARVAM_API_KEY") or ""
        if sarvam_key:
            try:
                text = ocr_with_sarvam(img_bytes, sarvam_key)
            except Exception:
                current_app.logger.exception("Sarvam poster OCR failed; trying local OCR.")
        if not text:
            try:
                text = image_to_text(img_bytes)
            except Exception:
                current_app.logger.exception("Local poster OCR failed.")
                raise ApiError("Could not read this poster. Paste its text or upload a clearer image.", 422)

    form_query = request.form.get("text") or ""
    json_data = request.get_json(silent=True) or {}
    user_text = form_query or (json_data.get("text") or "")
    auto_add = (
        request.form.get("auto_add", "").lower() in ("1", "true")
        or bool(json_data.get("auto_add"))
    )
    combined_query = f"{text}\n{user_text}".strip()
    if not combined_query:
        raise ApiError("Enter search text or upload an event flyer.")
    if len(combined_query) > 8000:
        raise ApiError("Search text must be 8,000 characters or fewer.")

    # Refresh the common public event table so selected results join canonical
    # public rows instead of creating personal duplicate event records.
    try:
        from ..services.discover_feed import sync_public_listings
        sync_public_listings()
    except Exception:
        current_app.logger.exception("Could not refresh public event listings before portal matching.")

    candidates = search_portal_catalog(combined_query, min_score=35.0)
    hydrated = []
    for candidate in candidates:
        event = Event.query.filter_by(url=candidate.get("url")).first()
        if not event or not event.is_public:
            continue
        item = {**candidate, "id": event.id, "event_id": event.id}
        for key in ("start_at", "end_at", "registration_deadline"):
            value = getattr(event, key)
            item[key] = value.isoformat() if value else None
        hydrated.append(item)

    if not hydrated:
        return jsonify(
            matched=False,
            high_confidence=False,
            match_score=0.0,
            candidates=[],
            choice_cards=[],
            message="No current public listing matched this text. Try the organiser's event title or add it manually.",
        )

    best = hydrated[0]
    high_confidence = best["match_score"] >= 70.0
    auto_added = False
    added_user_event_id = None

    if high_confidence and auto_add:
        event = db.session.get(Event, best["event_id"])
        if event and event.is_public:
            existing = UserEvent.query.filter_by(user_id=g.user.id, event_id=event.id).first()
            if existing:
                existing.status = "interested"
                user_event = existing
                db.session.commit()
            else:
                user_event = UserEvent(user_id=g.user.id, event_id=event.id, status="interested")
                db.session.add(user_event)
                try:
                    db.session.commit()
                except IntegrityError:
                    # A second request may have added this same public listing concurrently.
                    db.session.rollback()
                    user_event = UserEvent.query.filter_by(user_id=g.user.id, event_id=event.id).first()
                    if not user_event:
                        raise
            auto_added = True
            added_user_event_id = user_event.id

    return jsonify(
        matched=True,
        high_confidence=high_confidence,
        match_score=best["match_score"],
        best_match=best,
        auto_added=auto_added,
        added_user_event_id=added_user_event_id,
        choice_cards=hydrated[:3],
        message=f"{'✨ High-Confidence (>70%)' if high_confidence else 'Potential'} match on {best['platform']}: {best['title']}",
    )
