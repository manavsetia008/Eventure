"""Sanitization and input defense against Cross-Site Scripting (XSS) and injection attacks."""
import html
import re

# Dangerous patterns commonly found in XSS payloads
_SCRIPT_RE = re.compile(r"<\s*script[^>]*>.*?<\s*/\s*script\s*>", re.I | re.S)
_TAG_RE = re.compile(r"<\s*[/]?[a-zA-Z0-9]+[^>]*>", re.I)
_ON_EVENT_RE = re.compile(r"\bon[a-z]+\s*=", re.I)
_JAVASCRIPT_URI_RE = re.compile(r"javascript\s*:", re.I)

# SQLi token detection heuristics for defense-in-depth on search and raw query params
_SQLI_HEURISTIC_RE = re.compile(
    r"(\b(UNION(\s+ALL)?|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|EXEC(\s+XP_)?)\b|--|/\*|\*/|;)",
    re.I,
)


def sanitize_text(text: str, max_len: int = None, strip_tags: bool = True) -> str:
    """Sanitizes user input by removing script tags, dangerous URI handlers, and unescaped HTML.

    Defense-in-depth against stored and reflected XSS.
    """
    if text is None:
        return ""
    if not isinstance(text, str):
        text = str(text)

    # Remove script tags and embedded JavaScript
    cleaned = _SCRIPT_RE.sub("", text)
    cleaned = _JAVASCRIPT_URI_RE.sub("", cleaned)
    cleaned = _ON_EVENT_RE.sub("", cleaned)

    if strip_tags:
        # Strip all HTML tags completely for safe plain-text fields
        cleaned = _TAG_RE.sub("", cleaned)
    else:
        # Escape remaining HTML characters (<, >, &, ", ')
        cleaned = html.escape(cleaned)

    cleaned = cleaned.strip()
    if max_len and len(cleaned) > max_len:
        cleaned = cleaned[:max_len]
    return cleaned


def is_suspicious_sqli(text: str) -> bool:
    """Check if an input string contains raw SQL injection payload signatures."""
    if not text or not isinstance(text, str):
        return False
    return bool(_SQLI_HEURISTIC_RE.search(text))


def sanitize_url(url: str) -> str:
    """Ensure URLs are valid HTTP(S) links and do not use javascript: or data: schemes."""
    if not url:
        return ""
    cleaned = url.strip()
    if _JAVASCRIPT_URI_RE.search(cleaned) or cleaned.lower().startswith("data:"):
        return ""
    if not (cleaned.startswith("http://") or cleaned.startswith("https://")):
        cleaned = "https://" + cleaned
    return cleaned
