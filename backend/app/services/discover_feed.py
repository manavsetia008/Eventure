"""Public hackathon feed adapters.

Imports publicly visible listings from Unstop and Devfolio into Eventure's shared
public event catalogue. Event dates are only stored when a source publishes them.
This is best-effort discovery, not a guarantee that registration remains open.
"""
import html
import logging
import re
import threading
import time
from datetime import datetime
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

import requests

CACHE_TTL_SECONDS = 15 * 60
REQUEST_TIMEOUT_SECONDS = 5
USER_AGENT = "Eventure/1.0 (+https://github.com/Aryanrai-007/Eventure)"
_UNSTOP_URL = "https://unstop.com/api/public/opportunity/search-result"
_DEVFOLIO_URL = "https://devfolio.co/explore"

_cache_lock = threading.Lock()
_cached_items = []
_last_refresh = 0.0


def _text(value):
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        return ", ".join(filter(None, (_text(item) for item in value)))
    if isinstance(value, dict):
        return _text(value.get("name") or value.get("title") or value.get("city") or "")
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]*>", " ", str(value)))).strip()


def _pick(item, *keys):
    for key in keys:
        value = item.get(key) if isinstance(item, dict) else None
        if value not in (None, "", [], {}):
            return value
    return None


def _parse_datetime(value):
    if not value:
        return None
    if isinstance(value, (int, float)):
        # Public listing APIs sometimes return epoch seconds or milliseconds.
        numeric = value / 1000 if value > 10_000_000_000 else value
        try:
            return datetime.fromtimestamp(numeric)
        except (OverflowError, OSError, ValueError):
            return None
    raw = str(value).strip()
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=None)
    except ValueError:
        pass
    for pattern in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d %b %Y", "%d %B %Y"):
        try:
            return datetime.strptime(raw[:20], pattern)
        except ValueError:
            continue
    return None


def _valid_http_url(value, base):
    raw = _text(value)
    if not raw:
        return ""
    url = urljoin(base, raw)
    parsed = urlparse(url)
    return url if parsed.scheme in ("http", "https") and parsed.netloc else ""


def _walk_for_listings(payload):
    """Find the public opportunity list across minor Unstop response-shape changes."""
    if isinstance(payload, list):
        if payload and isinstance(payload[0], dict) and any(
            k in payload[0] for k in ("title", "name", "opportunity_name", "event_name")
        ):
            return payload
        for value in payload:
            found = _walk_for_listings(value)
            if found:
                return found
    elif isinstance(payload, dict):
        for key in ("data", "items", "results", "opportunities", "list", "result"):
            if key in payload:
                found = _walk_for_listings(payload[key])
                if found:
                    return found
    return []


def _normalise_unstop(item):
    title = _text(_pick(item, "title", "name", "opportunity_name", "event_name"))
    url = _valid_http_url(
        _pick(item, "url", "public_url", "seo_url", "short_url", "link", "slug"),
        "https://unstop.com/",
    )
    if not url and item.get("id"):
        url = f"https://unstop.com/hackathons/{item['id']}"
    if not title or not url:
        return None

    locations = _pick(item, "locations", "location", "city", "venue")
    venue = _text(locations)
    mode = _text(_pick(item, "mode", "region", "workplace_type", "event_mode")).lower()
    if not venue:
        venue = "Online" if any(word in mode for word in ("online", "virtual", "remote")) else "Venue to be confirmed"

    return {
        "title": title[:250],
        "platform": "Unstop",
        "category": "hackathon",
        "description": _text(_pick(item, "description", "snippet", "summary"))[:10000],
        "venue_name": venue[:250],
        "url": url[:500],
        "start_at": _parse_datetime(_pick(item, "start_date", "startDate", "start_at", "event_start_date", "eventStartDate", "event_start")),
        "end_at": _parse_datetime(_pick(item, "event_end_date", "eventEndDate", "end_at", "event_end")),
        "registration_deadline": _parse_datetime(_pick(item, "registration_end_date", "registrationEndDate", "registration_deadline", "last_date", "lastDate", "deadline", "closing_date")),
        "source": "public_feed",
    }


def fetch_unstop_listings():
    """Fetch currently-open hackathon listings from Unstop's public browse feed."""
    try:
        response = requests.get(
            _UNSTOP_URL,
            params={"opportunity": "hackathons", "per_page": 30, "oppstatus": "open"},
            headers={"Accept": "application/json", "User-Agent": USER_AGENT},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
        items = _walk_for_listings(payload)
        normalised = []
        for item in items:
            row = _normalise_unstop(item)
            if row:
                normalised.append(row)
        return normalised[:30]
    except (requests.RequestException, ValueError, TypeError) as exc:
        logging.info("Unstop public feed unavailable: %s", exc)
        return []


class _AnchorParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.anchors = []
        self.current = None

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "a":
            attrs = dict(attrs)
            self.current = {
                "href": attrs.get("href", ""),
                "title": attrs.get("title", ""),
                "aria": attrs.get("aria-label", ""),
                "text": [],
            }

    def handle_data(self, data):
        if self.current is not None:
            self.current["text"].append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self.current is not None:
            row = self.current
            row["text"] = _text(" ".join(row["text"]) or row["title"] or row["aria"])
            self.anchors.append(row)
            self.current = None


def _devfolio_card_context(source, start, end):
    # The explore page is server-rendered. Read forward from this card's link so
    # the status is taken from this listing, not the previous card's status.
    raw = source[start:min(len(source), end + 2200)]
    visible = _text(raw)
    status_match = re.search(r"\b(Open|Upcoming|Ended|Past)\b", visible, re.IGNORECASE)
    status = status_match.group(1).lower() if status_match else ""
    start_match = re.search(r"\bStarts\s+(\d{1,2}/\d{1,2}/\d{2,4})\b", visible, re.IGNORECASE)
    start_at = None
    if start_match:
        raw_date = start_match.group(1)
        for fmt in ("%d/%m/%y", "%d/%m/%Y"):
            try:
                start_at = datetime.strptime(raw_date, fmt)
                break
            except ValueError:
                continue
    venue = "Online" if re.search(r"\bOnline\b", visible, re.IGNORECASE) else "Offline venue to be confirmed"
    return status, start_at, venue


def fetch_devfolio_listings():
    """Read open/upcoming Devfolio microsite links from its public Explore page."""
    try:
        response = requests.get(
            _DEVFOLIO_URL,
            headers={"Accept": "text/html", "User-Agent": USER_AGENT},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        source = response.text
    except requests.RequestException as exc:
        logging.info("Devfolio public feed unavailable: %s", exc)
        return []

    parser = _AnchorParser()
    try:
        parser.feed(source)
    except Exception as exc:
        logging.info("Could not parse Devfolio Explore page: %s", exc)
        return []

    results = []
    seen = set()
    for anchor in parser.anchors:
        url = _valid_http_url(anchor.get("href"), _DEVFOLIO_URL)
        host = urlparse(url).hostname or ""
        if not host.endswith(".devfolio.co") or host in {"assets.devfolio.co", "org.devfolio.co"}:
            continue
        title = _text(anchor.get("text"))
        if len(title) < 3 or title.lower() in {"apply now", "see projects", "remind me"}:
            continue
        if url in seen:
            continue
        seen.add(url)

        # Find the matching anchor in the original HTML to retain the card's
        # open/upcoming state and any published start date.
        needle = anchor.get("href") or ""
        position = source.find(needle) if needle else -1
        if position < 0:
            continue
        status, start_at, venue = _devfolio_card_context(source, position, position + len(needle))
        if status not in {"open", "upcoming"}:
            continue

        results.append({
            "title": title[:250],
            "platform": "Devfolio",
            "category": "hackathon",
            "description": "Public Devfolio listing. Confirm dates, eligibility and registration status on the organiser's page.",
            "venue_name": venue,
            "url": url[:500],
            "start_at": start_at,
            "end_at": None,
            "registration_deadline": None,
            "source": "public_feed",
        })
    return results[:30]


def fetch_public_listings(force=False):
    """Return cached listings; only refresh the upstream sources every 15 minutes."""
    global _cached_items, _last_refresh
    with _cache_lock:
        if not force and time.monotonic() - _last_refresh < CACHE_TTL_SECONDS:
            return list(_cached_items)

        items = []
        items.extend(fetch_unstop_listings())
        items.extend(fetch_devfolio_listings())

        deduped = {}
        for item in items:
            url = item.get("url")
            title = item.get("title")
            if url and title:
                deduped[url] = item

        _cached_items = list(deduped.values())
        # Retry sooner after a provider outage/empty response instead of caching an
        # empty Discover feed for the full normal refresh window.
        _last_refresh = time.monotonic() - (CACHE_TTL_SECONDS - 60) if not _cached_items else time.monotonic()
        logging.info("Public discovery refresh returned %d listings.", len(_cached_items))
        return list(_cached_items)


def sync_public_listings():
    """Upsert fetched public listings so Discover cards can use normal event actions."""
    from ..extensions import db
    from ..models import Event

    items = fetch_public_listings()
    if not items:
        return 0

    urls = [item["url"] for item in items]
    existing = {row.url: row for row in Event.query.filter(Event.url.in_(urls)).all()}
    changed = 0

    for item in items:
        row = existing.get(item["url"])
        if row is not None and row.source != "public_feed":
            # Never overwrite an event a student or organiser created themselves.
            continue
        if row is None:
            row = Event(
                title=item["title"],
                platform=item["platform"],
                category=item["category"],
                description=item["description"],
                venue_name=item["venue_name"],
                url=item["url"],
                is_public=True,
                source="public_feed",
            )
            db.session.add(row)
        else:
            row.title = item["title"]
            row.platform = item["platform"]
            row.category = item["category"]
            row.description = item["description"]
            row.venue_name = item["venue_name"]
        # A feed is allowed to add verified fields, but never replaces existing
        # event dates with missing values from a shorter listing response.
        if item.get("start_at"):
            row.start_at = item["start_at"]
        if item.get("end_at"):
            row.end_at = item["end_at"]
        if item.get("registration_deadline"):
            row.registration_deadline = item["registration_deadline"]
        changed += 1

    if changed:
        db.session.commit()
    return changed
