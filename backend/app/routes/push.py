from flask import Blueprint, current_app, g, jsonify, request

from ..auth import login_required
from ..extensions import db
from ..models import PushSubscription
from ..services.push import push_configured, push_to_user
from ..utils import ApiError

bp = Blueprint("push", __name__, url_prefix="/api/push")


@bp.get("/key")
@login_required
def key():
    cfg = current_app.config
    return jsonify(public_key=cfg["VAPID_PUBLIC_KEY"] if push_configured(cfg) else None)


@bp.post("/subscribe")
@login_required
def subscribe():
    d = request.get_json(silent=True) or {}
    keys = d.get("keys") or {}
    if not (d.get("endpoint") and keys.get("p256dh") and keys.get("auth")):
        raise ApiError("That device did not send a valid push subscription.")
    row = PushSubscription.query.filter_by(endpoint=d["endpoint"]).first()
    if row:
        row.user_id, row.p256dh, row.auth = g.user.id, keys["p256dh"], keys["auth"]
    else:
        db.session.add(PushSubscription(user_id=g.user.id, endpoint=d["endpoint"], p256dh=keys["p256dh"], auth=keys["auth"]))
    db.session.commit()
    return jsonify(ok=True), 201


@bp.post("/unsubscribe")
@login_required
def unsubscribe():
    endpoint = (request.get_json(silent=True) or {}).get("endpoint")
    PushSubscription.query.filter_by(user_id=g.user.id, endpoint=endpoint).delete()
    db.session.commit()
    return jsonify(ok=True)


@bp.post("/test")
@login_required
def test():
    if not push_configured(current_app.config):
        raise ApiError("Push alerts are not set up on this server. Generate VAPID keys first.", 501)
    sent = push_to_user(current_app.config, g.user.id, "Eventure", "Alerts are on. We will only ping you when a deadline is at risk.", "/")
    if not sent:
        raise ApiError("No device received the test. Turn alerts off and on again on this device.", 502)
    return jsonify(sent=sent)
