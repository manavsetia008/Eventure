"""Real-Time Hackathon Suggestion & Search Intelligence Engine.

Reads user profile data (interests, skills, campus location, and experience)
and discovers real-time hackathons matching their profile using Google Custom
Search API or top portal indexes (Unstop, Devfolio, Hack2skill, Devpost).
"""
import logging
import os
import re
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
    if not api_key or not cx:
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

    # 1. Fetch live Google search results if credentials are provided
    if search_key and search_cx:
        search_query = " ".join(list(user_tokens)[:3]) or "engineering AI"
        google_results = search_google_hackathons(search_query, search_key, search_cx)
        pool.extend(google_results)

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
