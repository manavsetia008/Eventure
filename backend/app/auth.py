from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import current_app, g, request

from .utils import ApiError


def make_token(user_id, role="student", email=""):
    if hasattr(user_id, "id"):  # allow passing a User instance
        u = user_id
        user_id = u.id
        role = getattr(u, "role", "student") or "student"
        email = getattr(u, "email", "")
    expires = datetime.now(timezone.utc) + timedelta(hours=current_app.config["JWT_EXPIRY_HOURS"])
    payload = {
        "sub": str(user_id),
        "role": role or "student",
        "email": email or "",
        "iat": datetime.now(timezone.utc),
        "exp": expires,
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")


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


def role_required(*allowed_roles):
    """Requires the authenticated user to hold one of the specified roles."""
    def decorator(fn):
        @wraps(fn)
        @login_required
        def wrapper(*args, **kwargs):
            role = getattr(g.user, "role", "student") or "student"
            if role not in allowed_roles:
                raise ApiError(f"Access restricted to {', '.join(allowed_roles)}.", 403)
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def organizer_required(fn):
    """Convenience decorator for routes that need organizer or admin privileges."""
    return role_required("organizer", "admin")(fn)

