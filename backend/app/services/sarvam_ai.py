"""Sarvam AI Indic Intelligence Service.

Handles:
1. Indic & Hinglish event flyer/notice extraction using Sarvam-105B (Chat Completion API).
2. Multilingual translation of event descriptions and alerts using Sarvam Translate API.
3. Resilient fallback logic when offline or when no API key is configured.
"""
import json
import logging
import re
from datetime import datetime
import requests

SARVAM_BASE_URL = "https://api.sarvam.ai"
SARVAM_V2_URL = "https://api.sarvam.ai/v2"

SARVAM_SYSTEM_PROMPT = """You are an expert Indic information extraction model for college campus events, hackathons, and academic circulars.
Your job is to read unstructured text (which may be in English, Hindi, or code-mixed Hinglish) and extract structured event details.

CRITICAL RULES:
1. Output ONLY a valid JSON object matching the requested schema.
2. Never include markdown code fences (no ```json or ```), no conversational filler, no greetings.
3. Do not invent dates or venues that are not mentioned.
4. Output must start with { and end with }."""

SARVAM_EXTRACT_PROMPT = """Extract event details from the text below. Today's date is {today}.
Required JSON Schema:
{{
  "title": "Short event title (string)",
  "platform": "Unstop | Devfolio | Hack2skill | direct | null",
  "category": "hackathon | workshop | conference | seminar | contest | fest | other",
  "description": "Concise 1-2 sentence description (string)",
  "venue_name": "Venue name, campus, hall or 'Online' (string or null)",
  "start_at": "ISO 8601 local datetime YYYY-MM-DDTHH:MM or null",
  "end_at": "ISO 8601 local datetime YYYY-MM-DDTHH:MM or null",
  "registration_deadline": "ISO 8601 local datetime or null",
  "url": "Official registration URL or null",
  "stages": [
    {{"name": "Stage name (e.g. Abstract Submission, PPT, Shortlist, Finals)", "due_at": "YYYY-MM-DDTHH:MM"}}
  ],
  "confidence": 95
}}

TEXT TO EXTRACT:
\"\"\"{text}\"\"\"
"""


def _clean_json_str(raw: str) -> str:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.I).strip()
    if cleaned.endswith("```"):
        cleaned = re.sub(r"```$", "", cleaned).strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start != -1 and end != -1:
        return cleaned[start : end + 1]
    return cleaned


def extract_event_with_sarvam(text: str, api_key: str, model: str = "sarvam-105b", now_dt: datetime = None) -> dict:
    """Extract structured event milestones from raw or code-mixed text using Sarvam-105B."""
    if not api_key:
        raise ValueError("SARVAM_API_KEY is not configured.")

    now_str = (now_dt or datetime.now()).strftime("%A, %d %B %Y")
    prompt = SARVAM_EXTRACT_PROMPT.format(today=now_str, text=text[:5000])

    headers = {
        "Authorization": f"Bearer {api_key}",
        "api-subscription-key": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "model": model or "sarvam-105b",
        "messages": [
            {"role": "system", "content": SARVAM_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 1024,
    }

    resp = requests.post(
        f"{SARVAM_V2_URL}/chat/completions",
        headers=headers,
        json=payload,
        timeout=35,
    )
    resp.raise_for_status()
    result_data = resp.json()
    choices = result_data.get("choices", [])
    if not choices:
        raise ValueError("Empty choices returned from Sarvam API.")

    raw_content = choices[0].get("message", {}).get("content", "")
    parsed_json = json.loads(_clean_json_str(raw_content))
    parsed_json["source"] = f"sarvam ({model})"
    return parsed_json


def translate_with_sarvam(text: str, target_lang: str, api_key: str, source_lang: str = "en-IN") -> str:
    """Translate text using Sarvam Translate API (supports 22 Indic languages).
    
    Common target_lang codes:
    - 'hi-IN' (Hindi)
    - 'bn-IN' (Bengali)
    - 'ta-IN' (Tamil)
    - 'te-IN' (Telugu)
    - 'mr-IN' (Marathi)
    - 'gu-IN' (Gujarati)
    - 'pa-IN' (Punjabi)
    """
    if not text or not text.strip():
        return ""
    if not api_key:
        return text

    headers = {
        "api-subscription-key": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "input": text.strip(),
        "source_language_code": source_lang or "en-IN",
        "target_language_code": target_lang or "hi-IN",
    }

    try:
        resp = requests.post(f"{SARVAM_BASE_URL}/translate", headers=headers, json=payload, timeout=20)
        resp.raise_for_status()
        data = resp.json()
        return data.get("translated_text", text)
    except Exception as exc:
        logging.warning("Sarvam translation failed (%s), returning original text.", exc)
        return text
