"""Browser and phone push alerts using the Web Push standard (VAPID). Works in Chrome, Edge and Firefox,
and on Android and iOS when the PWA is installed. No Firebase account needed."""
import json
import logging


def push_configured(config):
    return bool(config.get("VAPID_PUBLIC_KEY") and config.get("VAPID_PRIVATE_KEY"))


def _send_one(config, sub, payload):
    """Returns 'ok', 'gone' (subscription expired, delete it) or 'error'."""
    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        logging.warning("pywebpush is not installed; push alerts are disabled.")
        return "error"
    try:
        webpush(
            subscription_info={"endpoint": sub["endpoint"], "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}},
            data=json.dumps(payload),
            vapid_private_key=config["VAPID_PRIVATE_KEY"],
            vapid_claims={"sub": config["VAPID_SUBJECT"]},
            ttl=3600,
        )
        return "ok"
    except WebPushException as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status in (404, 410):
            return "gone"
        logging.warning("Push failed: %s", exc)
    except Exception as exc:
        logging.warning("Push failed: %s", exc)
    return "error"


def push_to_user(config, user_id, title, body, url="/"):
    """Send a push to every device the user enabled. Returns how many were delivered."""
    if not push_configured(config):
        return 0
    from ..extensions import db
    from ..models import PushSubscription

    delivered = 0
    for row in PushSubscription.query.filter_by(user_id=user_id).all():
        result = _send_one(config, {"endpoint": row.endpoint, "p256dh": row.p256dh, "auth": row.auth},
                           {"title": title, "body": body, "url": url})
        if result == "ok":
            delivered += 1
        elif result == "gone":
            db.session.delete(row)
    db.session.commit()
    return delivered
