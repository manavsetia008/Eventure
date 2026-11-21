"""Hackathon suggestion engine backed by public web search and a curated seed catalogue.

Search snippets are not authoritative event records. Missing schedules and deadlines
remain unset until confirmed from an organiser's official listing.
"""
import logging
import os
import re
import urllib.parse
import requests
from datetime import datetime

from .portal_search import PORTAL_CATALOG


def _clean_query_words(text: str) -> list:
    if not text:
        return []
    words = re.findall(r"[a-zA-Z0-9]+", text.lower())
    stop = {"and", "or", "the", "for", "with", "in", "at", "to", "of", "a", "an"}
    return [w for w in words if len(w) > 2 and w not in stop]


def search_google_hackathons(query: str, api_key: str, cx: str) -> list:
    """Queries Google Custom Search API for live hackathon announcements."""
    if not api_key or not cx or api_key.startswith("http"):
        return []

    url = "https://www.googleapis.com/customsearch/v1"
    params = {
        "key": api_key,
        "cx": cx,
        "q": f"hackathon 2026 {query} registration",
        "num": 5,
    }
    try:
        resp = requests.get(url, params=params, timeout=12)
        if resp.status_code == 200:
            items = resp.json().get("items", [])
            results = []
            for item in items:
                title = item.get("title", "")
                snippet = item.get("snippet", "")
                link = item.get("link", "")
                platform = "Web"
                if "unstop.com" in link:
                    platform = "Unstop"
                elif "devfolio.co" in link:
                    platform = "Devfolio"
                elif "hack2skill.com" in link:
                    platform = "Hack2skill"
                elif "devpost.com" in link:
                    platform = "Devpost"

                results.append({
                    "id": f"google-{abs(hash(link)) % 100000}",
                    "title": title.split(" - ")[0].split(" | ")[0],
                    "platform": platform,
                    "category": "hackathon",
                    "venue_name": "Online / Regional",
                    "description": snippet,
                    "url": link,
                    # Search snippets rarely contain structured schedule fields. Never invent
                    # a start date or deadline; the student can confirm them on the official page.
                    "start_at": None,
                    "end_at": None,
                    "registration_deadline": None,
                    "source": "google_search",
                })
            return results
    except Exception as exc:
        logging.warning("Google search query failed: %s", exc)

    return []


def search_free_web_hackathons(query: str) -> list:
    """Free web search fallback using DuckDuckGo HTML without requiring any API keys."""
    url = "https://html.duckduckgo.com/html/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
    data = {"q": f"hackathon 2026 {query} devfolio unstop devpost registration"}
    try:
        resp = requests.post(url, data=data, headers=headers, timeout=8)
        if resp.status_code != 200:
            return []

        # Find result link anchors
        matches = re.findall(r'<a[^>]+class=["\']result__a["\'][^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', resp.text)
        results = []
        for raw_url, raw_title in matches[:6]:
            actual_url = raw_url
            if "uddg=" in raw_url:
                parsed = urllib.parse.parse_qs(urllib.parse.urlparse(raw_url).query)
                if "uddg" in parsed:
                    actual_url = parsed["uddg"][0]

            clean_title = re.sub(r"<[^>]+>", "", raw_title).strip()
            if not clean_title or len(clean_title) < 5:
                continue

            platform = "Web"
            if "unstop.com" in actual_url:
                platform = "Unstop"
            elif "devfolio.co" in actual_url:
                platform = "Devfolio"
            elif "devpost.com" in actual_url:
                platform = "Devpost"
            elif "hack2skill.com" in actual_url:
                platform = "Hack2skill"

            results.append({
                "id": f"web-{abs(hash(actual_url)) % 100000}",
                "title": clean_title.split(" - ")[0].split(" | ")[0],
                "platform": platform,
                "category": "hackathon",
                "venue_name": "Online / Regional",
                "description": f"Live web announcement: {clean_title}",
                "url": actual_url,
                # Search snippets rarely contain structured schedule fields. Never invent
                # a start date or deadline; the student can confirm them on the official page.
                "start_at": None,
                "end_at": None,
                "registration_deadline": None,
                "source": "free_web_search",
            })
        return results
    except Exception as exc:
        logging.warning("Free web hackathon search failed: %s", exc)
        return []


def suggest_hackathons_for_user(user, config: dict = None) -> list:
    """Rank imported public listings against the student's goals and campus."""
    user_goals = user.goals_list if hasattr(user, "goals_list") else (user.get("goals") or [])
    college_name = user.college if hasattr(user, "college") else (user.get("college") or "")

    user_tokens = set()
    for goal in user_goals:
        user_tokens.update(_clean_query_words(goal))
    user_tokens.update(_clean_query_words(college_name))

    try:
        from .discover_feed import fetch_public_listings
        pool = fetch_public_listings()
    except Exception as exc:
        logging.warning("Live hackathon feed unavailable for suggestions: %s", exc)
        pool = []

    scored = []
    seen_urls = set()
    for item in pool:
        title = _clean_query_words(item.get("title", ""))
        url = item.get("url") or ""
        if not title or not url or url in seen_urls:
            continue
        seen_urls.add(url)

        item_tokens = set(_clean_query_words(
            f"{item.get('title', '')} {item.get('description', '')} {item.get('platform', '')}"
        ))
        matched = sorted(user_tokens & item_tokens)
        overlap = len(matched) / max(len(user_tokens), 1)
        score = min(98.0, round(40.0 + overlap * 58.0, 1))
        platform = item.get("platform") or "Public listing"
        reason = (
            f"Matches your interests in {', '.join(matched[:3])}."
            if matched else f"Listed on {platform}. Confirm current dates and eligibility on the organiser's page."
        )
        scored.append({
            **item,
            "match_score": score,
            "matched_skills": matched,
            "reason": reason,
        })

    # The public adapters return datetime objects; a missing date sorts last.
    # Keep this key type-consistent so suggestions never turn the endpoint into a 500.
    def _sort_date(item):
        value = item.get("start_at")
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
            except ValueError:
                pass
        return datetime.max

    # Show clearly labelled catalogue candidates only when both live providers are
    # unavailable. These are prompts to verify on the organiser site, not live events.
    if not scored:
        for candidate in PORTAL_CATALOG:
            fallback = {
                **candidate,
                "start_at": None,
                "end_at": None,
                "registration_deadline": None,
                "source": "curated_unverified",
                "verified": False,
            }
            item_tokens = set(_clean_query_words(
                f"{fallback.get('title', '')} {fallback.get('description', '')} {fallback.get('platform', '')}"
            ))
            matched = sorted(user_tokens & item_tokens)
            overlap = len(matched) / max(len(user_tokens), 1)
            fallback["match_score"] = min(85.0, round(35.0 + overlap * 50.0, 1))
            fallback["matched_skills"] = matched
            fallback["reason"] = "Curated candidate only — verify that registration is currently open on the organiser's official page."
            scored.append(fallback)

    scored.sort(key=lambda item: (-item["match_score"], _sort_date(item)))
    return scored[:8]
