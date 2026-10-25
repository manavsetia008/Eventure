import hmac

from flask import Blueprint, current_app, g, jsonify, request

from ..auth import login_required
from ..extensions import db
from ..models import InboxItem
from ..services.inbox import find_token, forwarding_address, html_to_text, ingest_email, parse_raw_email
from ..utils import ApiError

bp = Blueprint("inbox", __name__, url_prefix="/api")


@bp.get("/inbox")
@login_required
def list_inbox():
    items = InboxItem.query.filter_by(user_id=g.user.id, status="pending").order_by(InboxItem.created_at.desc()).all()
    address = forwarding_address(current_app.config["INBOX_ADDRESS"], g.user.inbox_token)
    return jsonify(items=[i.to_dict() for i in items], forwarding_address=address, token=g.user.inbox_token)


@bp.post("/inbox/<int:item_id>/dismiss")
@login_required
def dismiss(item_id):
    item = db.session.get(InboxItem, item_id)
    if not item or item.user_id != g.user.id:
        raise ApiError("That inbox item does not exist.", 404)
    item.status = "dismissed"
    db.session.commit()
    return jsonify(ok=True)


@bp.post("/inbound/email")
def inbound_email():
    """Webhook for mail providers (Mailgun, SendGrid, Postmark style). Protected by INBOUND_SECRET."""
    secret = current_app.config["INBOUND_SECRET"]
    if not secret or not hmac.compare_digest(request.headers.get("X-Inbound-Secret", ""), secret):
        raise ApiError("Not allowed.", 403)
    data = request.get_json(silent=True) or request.form

    raw = data.get("email")  # some providers can post the full MIME message
    if raw:
        mail = parse_raw_email(raw.encode("utf-8") if isinstance(raw, str) else raw)
    else:
        body = data.get("text") or data.get("body-plain") or html_to_text(data.get("html") or data.get("body-html") or "")
        mail = {
            "token": find_token(data.get("to") or "", data.get("recipient") or "", data.get("envelope-to") or ""),
            "subject": data.get("subject") or "",
            "sender": data.get("from") or data.get("sender") or "",
            "body": body,
            "message_id": data.get("message_id") or data.get("Message-Id") or None,
        }
    item = ingest_email(current_app.config, mail["token"], mail["subject"], mail["body"], mail["sender"], mail["message_id"])
    return jsonify(accepted=bool(item)), 202 if item else 200
