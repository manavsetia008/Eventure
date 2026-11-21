"""Real-Time Hackathon Suggestion & Search Intelligence Engine.

Reads user profile data (interests, skills, campus location, and experience)
and discovers real-time hackathons matching their profile using Google Custom
Search API or free live web search (DuckDuckGo & top portal indexes: Unstop, Devfolio, Hack2skill, Devpost).
"""
import logging
import os
import re
import urllib.parse
from datetime import datetime, timedelta
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
                    "start_at": (datetime.now() + timedelta(days=14)).isoformat(),
                    "registration_deadline": (datetime.now() + timedelta(days=7)).isoformat(),
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
                "start_at": (datetime.now() + timedelta(days=14)).isoformat(),
                "registration_deadline": (datetime.now() + timedelta(days=7)).isoformat(),
                "source": "free_web_search",
            })
        return results
    except Exception as exc:
        logging.warning("Free web hackathon search failed: %s", exc)
        return []


def suggest_hackathons_for_user(user, config: dict = None) -> list:
    """Generates personalized, real-time hackathon suggestions for a student."""
    config = config or {}
    user_goals = user.goals_list if hasattr(user, "goals_list") else (user.get("goals") or [])
    user_tokens = set()
    for g in user_goals:
        user_tokens.update(_clean_query_words(g))

    college_name = user.college if hasattr(user, "college") else (user.get("college") or "")
    if college_name:
        user_tokens.update(_clean_query_words(college_name))

    search_key = config.get("GOOGLE_SEARCH_API_KEY") or os.getenv("GOOGLE_SEARCH_API_KEY", "")
    search_cx = config.get("GOOGLE_SEARCH_CX") or os.getenv("GOOGLE_SEARCH_CX", "")

    pool = []

    # 1. Fetch live search results: Google Custom Search if key provided, else Free Web Search fallback
    search_query = " ".join(list(user_tokens)[:3]) or "engineering AI"
    if search_key and search_cx and not search_key.startswith("http"):
        google_results = search_google_hackathons(search_query, search_key, search_cx)
        pool.extend(google_results)
    else:
        web_results = search_free_web_hackathons(search_query)
        pool.extend(web_results)

    # 2. Add verified curated portal index events
    for cat_item in PORTAL_CATALOG:
        pool.append({**cat_item, "source": "verified_portal_catalog"})

    # 3. Compute personalized match score for each candidate
    scored_candidates = []
    seen_titles = set()

    for item in pool:
        title = item.get("title", "")
        if title in seen_titles:
            continue
        seen_titles.add(title)

        desc = item.get("description", "")
        combined_text = f"{title} {desc} {item.get('platform', '')}".lower()
        candidate_tokens = set(_clean_query_words(combined_text))

        # Skill overlap
        matched_skills = user_tokens & candidate_tokens
        overlap_score = (len(matched_skills) / max(len(user_tokens), 1)) * 60.0

        # Base category / platform score
        base_score = 30.0
        if "hackathon" in combined_text:
            base_score += 10.0

        total_score = min(98.0, round(base_score + overlap_score, 1))

        matched_list = list(matched_skills)
        reason = (
            f"Matches your target skills in {', '.join(matched_list[:2])}."
            if matched_list
            else "Trending flagship campus hackathon open for all branches."
        )

        scored_candidates.append({
            **item,
            "match_score": total_score,
            "matched_skills": matched_list,
            "reason": reason,
        })

    # Sort descending by match score
    scored_candidates.sort(key=lambda x: -x["match_score"])
    return scored_candidates[:6]
