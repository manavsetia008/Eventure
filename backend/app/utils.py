"""Small helpers shared by routes and services. No database imports here."""
from datetime import date, datetime


class ApiError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def now():
    """Current time as a naive local datetime. All event times are naive campus-local times."""
    return datetime.now()


def parse_dt(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    s = str(value).strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        raise ApiError(f"Invalid date or time: {value}")
    if dt.tzinfo is not None:
        dt = dt.astimezone().replace(tzinfo=None)
    return dt


def parse_date(value):
    if value in (None, ""):
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        raise ApiError(f"Invalid date: {value}")


def iso(dt):
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.isoformat(timespec="minutes")
    return dt.isoformat()


def to_float(value):
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        raise ApiError(f"Invalid number: {value}")


def to_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
