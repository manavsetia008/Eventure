"""High-confidence matching against current, publicly fetched event listings.

This module deliberately does not ship a static list of dated event records.
Only the public Unstop/Devfolio adapters can supply event candidates; when those
feeds are down, the matcher returns no event rather than inventing a schedule.
"""
import difflib
import logging
import re
from urllib.parse import urlparse


def _normalize_tokens(text: str) -> set:
    if not text:
        return set()
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    words = cleaned.split()
    stop = {
        "the", "a", "an", "and", "or", "in", "at", "for", "of", "to",
        "with", "hackathon", "event", "2026",
    }
    return {word for word in words if len(word) > 2 and word not in stop}


def compute_match_score(query: str, portal_item: dict) -> float:
    """Return a conservative similarity score; 70+ requires a distinctive title match."""
    q_norm = re.sub(r"\s+", " ", (query or "").lower()).strip()
    title = re.sub(r"\s+", " ", (portal_item.get("title") or "").lower()).strip()
    if not q_norm or not title:
        return 0.0
    if q_norm == title:
        return 100.0
    # A sufficiently long title phrase embedded in poster OCR is a strong signal.
    if len(title) >= 8 and title in q_norm:
        return 92.0
    if len(q_norm) >= 10 and q_norm in title:
        return 90.0

    query_tokens = _normalize_tokens(q_norm)
    title_tokens = _normalize_tokens(title)
    if not query_tokens or not title_tokens:
        return round(difflib.SequenceMatcher(None, q_norm[:120], title[:120]).ratio() * 45, 1)

    matched_title = query_tokens & title_tokens
    query_coverage = len(matched_title) / len(query_tokens)
    title_coverage = len(matched_title) / len(title_tokens)
    # Description overlap is a weak supporting signal, never enough to mark an event high confidence.
    description_tokens = _normalize_tokens(portal_item.get("description") or "")
    description_coverage = len(query_tokens & description_tokens) / len(query_tokens)
    sequence = difflib.SequenceMatcher(None, q_norm[:120], title[:120]).ratio()
    score = (45 * query_coverage) + (30 * title_coverage) + (10 * description_coverage) + (15 * sequence)
    return round(min(69.0, score), 1)


def search_portal_catalog(query: str, min_score: float = 30.0) -> list:
    """Find matches only in current feed data, with no fabricated dates or venues."""
    if not (query or "").strip():
        return []

    try:
        from .discover_feed import fetch_public_listings
        listings = fetch_public_listings()
    except Exception:
        logging.exception("Current public listings could not be loaded for portal matching.")
        return []

    candidates = []
    seen = set()
    for item in listings:
        if not isinstance(item, dict):
            continue
        title = (item.get("title") or "").strip()
        url = (item.get("url") or "").strip()
        parsed = urlparse(url)
        if not title or parsed.scheme not in ("https", "http") or not parsed.netloc or url in seen:
            continue
        host = (parsed.hostname or "").lower()
        if not (host == "unstop.com" or host.endswith(".devfolio.co")):
            continue
        seen.add(url)
        score = compute_match_score(query, item)
        if score < min_score:
            continue
        candidates.append({
            **item,
            "source": "public_feed",
            "verified": False,
            "match_score": score,
        })

    candidates.sort(key=lambda item: -item["match_score"])
    return candidates[:8]
