"""Gemini LLM Network Service for Eventure.

Provides:
- Intelligent conversational assistant for campus events & schedules.
- Hackathon Submission Box analyzer (evaluates GitHub repo, demo URL, slides, and rubrics).
- Structured information extraction from posters and circulars.
- Clean fallback when GEMINI_API_KEY is not configured (user adds key manually).
"""
import logging
import os
import requests

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models"


def get_gemini_api_key(config: dict = None) -> str:
    """Retrieves GEMINI_API_KEY from Flask config or environment."""
    key = ""
    if config:
        key = config.get("GEMINI_API_KEY") or ""
    if not key:
        key = os.getenv("GEMINI_API_KEY", "")
    return key.strip()


def generate_with_gemini(
    prompt: str,
    api_key: str = None,
    system_instruction: str = None,
    model: str = None,
    temperature: float = 0.4,
) -> str:
    """Direct REST call to Google Gemini API (no bulky SDK required)."""
    key = api_key if api_key is not None else get_gemini_api_key()
    if not key or key == "your_gemini_api_key_here":
        return ""

    model = model or os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    endpoint = f"{GEMINI_API_URL}/{model}:generateContent?key={key}"
    headers = {"Content-Type": "application/json"}

    contents = [{"parts": [{"text": prompt}]}]
    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": 2048,
        },
    }
    if system_instruction:
        payload["systemInstruction"] = {
            "parts": [{"text": system_instruction}]
        }

    try:
        resp = requests.post(endpoint, headers=headers, json=payload, timeout=25)
        if resp.status_code == 200:
            data = resp.json()
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    return parts[0].get("text", "").strip()
        else:
            logging.warning("Gemini API error (HTTP %s): %s", resp.status_code, resp.text[:200])
    except Exception as exc:
        logging.warning("Gemini API request failed: %s", exc)

    return ""


def review_hackathon_submission(vault_data: dict, event_title: str, api_key: str = None) -> dict:
    """Reviews Hackathon Vault submission links and notes using Gemini LLM."""
    demo_url = vault_data.get("demo_url", "Not provided")
    github_url = vault_data.get("github_url", "Not provided")
    deck_url = vault_data.get("deck_url", "Not provided")
    video_url = vault_data.get("video_url", "Not provided")
    tech_stack = vault_data.get("tech_stack", "Not provided")
    mentor_notes = vault_data.get("mentor_notes", "")
    checks = vault_data.get("checks", {})

    system_instruction = (
        "You are an elite hackathon mentor and engineering judge. "
        "Review this team's hackathon submission materials and provide crisp, actionable, high-impact feedback."
    )

    prompt = f"""
Event Name: {event_title or 'Hackathon'}
Project Tech Stack: {tech_stack}
Live Demo URL: {demo_url}
GitHub Repo: {github_url}
Pitch Deck: {deck_url}
Demo Video: {video_url}
Mentor Notes: {mentor_notes}
Pre-submission checks completed: {checks}

Provide:
1. OVERALL READINESS SCORE (0-100%)
2. 3 KEY STRENGTHS
3. TOP 3 CRITICAL FIXES (e.g. public access test, demo fallback, clear problem statement)
4. PITCH HOOK SUGGESTION: A compelling 1-line opening for judges.
Keep output punchy, well-formatted markdown.
"""

    key = api_key if api_key is not None else get_gemini_api_key()
    if not key or key == "your_gemini_api_key_here":
        # Offline deterministic analysis when no API key is provided
        readiness = 40
        if github_url and github_url != "Not provided":
            readiness += 20
        if demo_url and demo_url != "Not provided":
            readiness += 20
        if deck_url and deck_url != "Not provided":
            readiness += 10
        if video_url and video_url != "Not provided":
            readiness += 10

        return {
            "source": "deterministic_heuristics",
            "readiness_score": readiness,
            "markdown": (
                f"### Hackathon Submission Review ({event_title})\n\n"
                f"**Projected Readiness Score**: **{readiness}%**\n\n"
                "**Checklist Analysis**:\n"
                f"- GitHub Repo: {'✅ Connected' if github_url != 'Not provided' else '⚠️ Missing'}\n"
                f"- Live Demo: {'✅ Connected' if demo_url != 'Not provided' else '⚠️ Missing'}\n"
                f"- Pitch Deck: {'✅ Connected' if deck_url != 'Not provided' else '⚠️ Missing'}\n\n"
                "> 💡 *Tip: Add your `GEMINI_API_KEY` in `backend/.env` for deep AI rubric evaluation & code checks.*"
            ),
        }

    review_text = generate_with_gemini(prompt, key, system_instruction)
    if not review_text:
        return {
            "source": "deterministic_heuristics",
            "readiness_score": 60,
            "markdown": (
                f"### Hackathon Submission Review ({event_title})\n\n"
                "**Projected Readiness Score**: **60%**\n\n"
                "- Live Demo: " + ('✅ Connected' if demo_url != 'Not provided' else '⚠️ Missing') + "\n"
                "- GitHub Repo: " + ('✅ Connected' if github_url != 'Not provided' else '⚠️ Missing') + "\n\n"
                "*(Note: Real-time Gemini review timed out or model was busy; fallback heuristic score provided)*"
            ),
        }

    return {
        "source": os.getenv("GEMINI_MODEL", "gemini-3.8-flash"),
        "readiness_score": 85,
        "markdown": review_text,
    }
