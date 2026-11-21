"""Sarvam AI Indic Intelligence Service.

Handles:
1. Indic & Hinglish event flyer/notice extraction using Sarvam-105B (Chat Completion API).
2. Multilingual translation of event descriptions and alerts using Sarvam Translate API.
3. Indic Text-to-Speech (read-aloud) using Sarvam Bulbul TTS API.
4. Resilient fallback logic when offline or when no API key is configured.
"""
import json
import logging
import re
import time
from datetime import datetime
import requests

SARVAM_BASE_URL = "https://api.sarvam.ai"
SARVAM_V1_URL = "https://api.sarvam.ai/v1"
SARVAM_V2_URL = "https://api.sarvam.ai/v2"

# BCP-47 Language code mapping for Sarvam Indic APIs
INDIC_LANG_MAP = {
    "hi": "hi-IN",
    "bn": "bn-IN",
    "ta": "ta-IN",
    "te": "te-IN",
    "mr": "mr-IN",
    "gu": "gu-IN",
    "pa": "pa-IN",
    "kn": "kn-IN",
    "ml": "ml-IN",
    "od": "od-IN",
    "en": "en-IN",
}

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


def extract_event_with_sarvam(text: str, api_key: str, model: str = "sarvam-105b-conversations", now_dt: datetime = None) -> dict:
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
    
    # sarvam-105b-conversations is the fast instruction-following endpoint (2s response)
    chosen_model = model or "sarvam-105b-conversations"
    payload = {
        "model": chosen_model,
        "messages": [
            {"role": "system", "content": SARVAM_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.1,
        "max_tokens": 1500,
    }

    # Try v1 first, then fallback to v2
    endpoints = [
        f"{SARVAM_V1_URL}/chat/completions",
        f"{SARVAM_V2_URL}/chat/completions",
    ]
    last_err = None
    for ep in endpoints:
        try:
            resp = requests.post(ep, headers=headers, json=payload, timeout=25)
            if resp.status_code == 200:
                result_data = resp.json()
                choices = result_data.get("choices", [])
                if choices:
                    raw_content = choices[0].get("message", {}).get("content", "")
                    if raw_content:
                        parsed_json = json.loads(_clean_json_str(raw_content))
                        parsed_json["source"] = f"sarvam ({chosen_model})"
                        return parsed_json
        except Exception as exc:
            last_err = exc
            continue

    if last_err:
        raise last_err
    raise ValueError("Empty or invalid response from Sarvam AI Chat API.")


def translate_with_sarvam(text: str, target_lang: str, api_key: str, source_lang: str = "en-IN", model: str = "sarvam-translate:v1") -> str:
    """Translate text using Sarvam Translate API (supports 22 Indic languages).
    
    Supports language codes like 'hi', 'hi-IN', 'bn', 'ta', 'te', 'mr', etc.
    """
    if not text or not text.strip():
        return ""
    if not api_key:
        return text

    target_code = INDIC_LANG_MAP.get(target_lang, target_lang)
    if "-" not in target_code and len(target_code) == 2:
        target_code = f"{target_code}-IN"

    headers = {
        "api-subscription-key": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "input": text.strip()[:2000],
        "source_language_code": source_lang or "en-IN",
        "target_language_code": target_code,
        "model": model or "sarvam-translate:v1",
    }

    try:
        resp = requests.post(f"{SARVAM_BASE_URL}/translate", headers=headers, json=payload, timeout=20)
        resp.raise_for_status()
        data = resp.json()
        return data.get("translated_text", text)
    except Exception as exc:
        logging.warning("Sarvam translation failed (%s), returning original text.", exc)
        return text


def speak_with_sarvam(text: str, target_lang: str, api_key: str, speaker: str = "aditya", model: str = "bulbul:v3") -> str:
    """Generate Indic audio for text using Sarvam Bulbul Text-to-Speech API.
    
    Returns base64 encoded audio string.
    """
    if not text or not text.strip() or not api_key:
        return ""

    target_code = INDIC_LANG_MAP.get(target_lang, target_lang)
    if "-" not in target_code and len(target_code) == 2:
        target_code = f"{target_code}-IN"

    headers = {
        "api-subscription-key": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "inputs": [text.strip()[:500]],
        "target_language_code": target_code,
        "speaker": speaker or "aditya",
        "model": model or "bulbul:v3",
    }

    try:
        resp = requests.post(f"{SARVAM_BASE_URL}/text-to-speech", headers=headers, json=payload, timeout=25)
        resp.raise_for_status()
        data = resp.json()
        audios = data.get("audios", [])
        return audios[0] if audios else ""
    except Exception as exc:
        logging.warning("Sarvam TTS failed (%s)", exc)
        return ""


def ocr_with_sarvam(image_bytes: bytes, api_key: str) -> str:
    """Extract text from poster/flyer image using Sarvam Indic Document AI."""
    if not image_bytes or not api_key:
        return ""
    headers = {
        "api-subscription-key": api_key,
    }
    files = {
        "file": ("poster.png", image_bytes, "image/png"),
    }
    try:
        resp = requests.post(f"{SARVAM_BASE_URL}/doc-ai/v1/job/parse", headers=headers, files=files, timeout=30)
        if resp.status_code in (200, 201):
            job_data = resp.json()
            job_id = job_data.get("job_id")
            if not job_id:
                return job_data.get("parsed_text", "")

            # Poll for async completion
            results_url = f"{SARVAM_BASE_URL}/doc-ai/v1/job/{job_id}/results"
            for _ in range(12):
                time.sleep(1)
                r = requests.get(results_url, headers=headers, timeout=10)
                if r.status_code == 200:
                    res_json = r.json()
                    status = res_json.get("status")
                    if status == "completed":
                        lines = []
                        for doc in res_json.get("documents", []):
                            for page in doc.get("pages", []):
                                for block in page.get("blocks", []):
                                    t = (block.get("text") or "").strip()
                                    if t:
                                        lines.append(t)
                        return "\n".join(lines)
                    elif status in ("failed", "error"):
                        break
    except Exception as exc:
        logging.warning("Sarvam Document OCR failed (%s), falling back...", exc)
    return ""
