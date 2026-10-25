"""Tiny in-memory rate limiter for sign-in and sign-up. One process only; use a shared store if you scale out."""
import threading
import time
from collections import defaultdict, deque
from functools import wraps

from flask import current_app, request

from .utils import ApiError


class Limiter:
    def __init__(self, limit, window_seconds):
        self.limit = limit
        self.window = window_seconds
        self.hits = defaultdict(deque)
        self.lock = threading.Lock()

    def _prune(self, key, now):
        q = self.hits[key]
        while q and q[0] <= now - self.window:
            q.popleft()
        return q

    def blocked(self, key, now=None):
        """True if `key` already used up its allowance. Does not count as a hit."""
        now = time.time() if now is None else now
        with self.lock:
            return len(self._prune(key, now)) >= self.limit

    def hit(self, key, now=None):
        now = time.time() if now is None else now
        with self.lock:
            self._prune(key, now).append(now)

    def allow(self, key, now=None):
        now = time.time() if now is None else now
        with self.lock:
            q = self.hits[key]
            while q and q[0] <= now - self.window:
                q.popleft()
            if len(q) >= self.limit:
                return False
            q.append(now)
            return True


def rate_limited(limiter):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if not current_app.config.get("TESTING") and not limiter.allow(request.remote_addr or "unknown"):
                raise ApiError("Too many attempts. Wait a few minutes and try again.", 429)
            return fn(*args, **kwargs)

        return wrapper

    return decorator
