"""Hackathon suggestion engine backed by public web search and a curated seed catalogue.

Search snippets are not authoritative event records. Missing schedules and deadlines
remain unset until confirmed from an organiser's official listing.
"""
import logging
import os
import re
import urllib.parse
import requests

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
    """Rank live public listings against the student's goals and campus."""
    config = config or {}
    user_goals = user.goals_list if hasattr(user, "goals_list") else (user.get("goals") or [])
    college_name = user.college if hasattr(user, "college") else (user.get("college") or "")

    user_tokens = set()
    for goal in user_goals:
        user_tokens.update(_clean_query_words(goal))
    user_tokens.update(_clean_query_words(college_name))

    pool = []
    # These providers expose public browse pages; no paid search key is needed.
    try:
        from .discover_feed import fetch_public_listings
        pool.extend(fetch_public_listings())
    except Exception as exc:
        logging.warning("Live hackathon feed unavailable for suggestions: %s", exc)

    # Optional Google Custom Search fallback when the owner has configured a CSE key.
    search_key = config.get("GOOGLE_SEARCH_API_KEY") or os.getenv("GOOGLE_SEARCH_API_KEY", "")
    search_cx = config.get("GOOGLE_SEARCH_CX") or os.getenv("GOOGLE_SEARCH_CX", "")
    if not pool and search_key and search_cx:
        search_query = " ".join(sorted(user_tokens)[:4]) or "software engineering"
        pool.extend(search_google_hackathons(search_query, search_key, search_cx))

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
            if matched else f"Currently listed on {platform}. Check the organiser page for the latest details."
        )
        scored.append({
            **item,
            "match_score": score,
            "matched_skills": matched,
            "reason": reason,
        })

    scored.sort(key=lambda item: (-item["match_score"], item.get("start_at") or "9999"))
    return scored[:8]
