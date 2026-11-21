"""Distributed Redis-backed and in-memory rate limiter with overload shield.

Features:
- Redis sliding-window log when REDIS_URL is configured.
- Seamless, zero-configuration thread-safe in-memory fallback.
- Overload shield protecting authentication, extraction, and search endpoints.
"""
import logging
import os
import threading
import time
from collections import defaultdict, deque
from functools import wraps

from flask import current_app, request

from .utils import ApiError

_redis_client = None
_redis_checked = False


def get_redis_client():
    global _redis_client, _redis_checked
    if not _redis_checked:
        _redis_checked = True
        redis_url = os.environ.get("REDIS_URL")
        if redis_url:
            try:
                import redis
                client = redis.from_url(redis_url, decode_responses=True)
                client.ping()
                _redis_client = client
                logging.info("Redis rate-limiting backend connected successfully.")
            except Exception as e:
                logging.warning("Redis configured but unavailable (%s). Falling back to in-memory limiter.", e)
                _redis_client = None
    return _redis_client


class Limiter:
    def __init__(self, limit, window_seconds, name="default"):
        self.limit = limit
        self.window = window_seconds
        self.name = name
        self.hits = defaultdict(deque)
        self.lock = threading.Lock()

    def _redis_allow(self, r, key, now):
        redis_key = f"rl:{self.name}:{key}"
        try:
            pipe = r.pipeline()
            # Remove hits older than the current window
            pipe.zremrangebyscore(redis_key, 0, now - self.window)
            # Count current hits in window
            pipe.zcard(redis_key)
            # Add current hit
            pipe.zadd(redis_key, {str(now): now})
            # Set key TTL
            pipe.expire(redis_key, self.window + 5)
            res = pipe.execute()
            count = res[1]
            if count >= self.limit:
                return False
            return True
        except Exception as exc:
            logging.warning("Redis operation failed, falling back to memory: %s", exc)
            return None  # signal fallback

    def _redis_blocked(self, r, key, now):
        redis_key = f"rl:{self.name}:{key}"
        try:
            pipe = r.pipeline()
            pipe.zremrangebyscore(redis_key, 0, now - self.window)
            pipe.zcard(redis_key)
            res = pipe.execute()
            return res[1] >= self.limit
        except Exception:
            return None

    def _prune(self, key, now):
        q = self.hits[key]
        while q and q[0] <= now - self.window:
            q.popleft()
        return q

    def blocked(self, key, now=None):
        """True if `key` already used up its allowance. Does not count as a hit."""
        now = time.time() if now is None else now
        r = get_redis_client()
        if r:
            res = self._redis_blocked(r, key, now)
            if res is not None:
                return res

        with self.lock:
            return len(self._prune(key, now)) >= self.limit

    def hit(self, key, now=None):
        now = time.time() if now is None else now
        r = get_redis_client()
        if r:
            try:
                redis_key = f"rl:{self.name}:{key}"
                r.zadd(redis_key, {str(now): now})
                r.expire(redis_key, self.window + 5)
                return
            except Exception:
                pass

        with self.lock:
            self._prune(key, now).append(now)

    def allow(self, key, now=None):
        now = time.time() if now is None else now
        r = get_redis_client()
        if r:
            res = self._redis_allow(r, key, now)
            if res is not None:
                return res

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
                raise ApiError("Too many attempts. Overload shield active, please wait a few moments and try again.", 429)
            return fn(*args, **kwargs)

        return wrapper

    return decorator
