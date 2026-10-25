from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import current_app, g, request

from .utils import ApiError


def make_token(user_id):
    expires = datetime.now(timezone.utc) + timedelta(hours=current_app.config["JWT_EXPIRY_HOURS"])
    return jwt.encode({"sub": str(user_id), "exp": expires}, current_app.config["SECRET_KEY"], algorithm="HS256")


def _token_from_request():
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[7:]
    # Calendar apps cannot send headers, so the .ics feed accepts ?token=
    return request.args.get("token")


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        from .extensions import db
        from .models import User

        token = _token_from_request()
        if not token:
            raise ApiError("Sign in to continue.", 401)
        try:
            payload = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
            user = db.session.get(User, int(payload["sub"]))
        except (jwt.PyJWTError, ValueError, KeyError):
            raise ApiError("Your session expired. Sign in again.", 401)
        if user is None:
            raise ApiError("Your session expired. Sign in again.", 401)
        g.user = user
        return fn(*args, **kwargs)

    return wrapper
