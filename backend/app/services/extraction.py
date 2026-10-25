"""Turn pasted text (or OCR text from a poster) into structured event details.

Uses an LLM when ANTHROPIC_API_KEY is set, otherwise (or on any failure) a rule-based parser.
The student always confirms the result in the UI before anything is saved.
"""
import json
import logging
import re
from datetime import date, datetime, time, timedelta

import requests

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}
_M = r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
RANGE_RE = re.compile(rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s*(?:-|\u2013|to)\s*(\d{{1,2}})(?:st|nd|rd|th)?\s+{_M}\b(?:[,\s]+(\d{{4}}))?", re.I)
DMY_RE = re.compile(rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s+{_M}\b(?:[,\s]+(\d{{4}}))?", re.I)
MDY_RE = re.compile(rf"\b{_M}\s+(\d{{1,2}})(?:st|nd|rd|th)?\b(?:[,\s]+(\d{{4}}))?", re.I)
ISO_RE = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b")
SLASH_RE = re.compile(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b")
TIME_RE = re.compile(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b([01]?\d|2[0-3]):([0-5]\d)\b", re.I)
URL_RE = re.compile(r"https?://[^\s)>\]]+", re.I)
DEADLINE_RE = re.compile(
    r"deadline|last date|registrations?\s*(?:close|closes|closing|end|ends|by|before|till|until)|"
    r"register\s*(?:by|before|till|until)|apply\s*(?:by|before)",
    re.I,
)

PLATFORMS = {
    "unstop.com": "Unstop", "devfolio.co": "Devfolio", "hack2skill.com": "Hack2skill",
    "reskilll.com": "Reskilll", "townscript.com": "Townscript", "konfhub.com": "KonfHub",
    "insider.in": "Insider", "commudle.com": "Commudle", "lu.ma": "Luma", "luma.com": "Luma",
    "eventbrite.": "Eventbrite", "dare2compete.com": "Unstop", "devpost.com": "Devpost",
}
CATEGORIES = [
    ("hackathon", r"hackathon|hack\s*fest|codeathon|buildathon"),
    ("workshop", r"workshop|bootcamp|masterclass|hands-on"),
    ("conference", r"conference|summit|symposium|conclave"),
    ("seminar", r"seminar|webinar|talk|lecture|panel"),
    ("contest", r"contest|competition|quiz|case study|challenge|olympiad|ctf"),
    ("fest", r"\bfest\b|festival|cultural|techfest"),
]
STAGE_KEYWORDS = [
    ("Submit", r"submission|submit|abstract|idea"),
    ("Shortlist", r"shortlist"),
    ("Results", r"results?\b|winners?"),
    ("Round 2", r"round\s*2|final round|finale"),
]


def _infer_year(month, day, now):
    year = now.year
    try:
        if date(year, month, day) < now.date() - timedelta(days=30):
            year += 1
    except ValueError:
        pass
    return year


def _mk_date(day, month, year, now):
    year = int(year) if year else _infer_year(month, day, now)
    try:
        return date(year, month, day)
    except ValueError:
        return None


def find_dates(text, now):
    """[(start_date, end_date|None, (pos_start, pos_end))] in reading order."""
    found, taken = [], []

    def free(span):
        return all(span[1] <= t[0] or span[0] >= t[1] for t in taken)

    def add(start, end, span):
        if start and free(span):
            found.append((start, end, span))
            taken.append(span)

    for m in RANGE_RE.finditer(text):
        month = MONTHS[m.group(3)[:3].lower()]
        add(_mk_date(int(m.group(1)), month, m.group(4), now), _mk_date(int(m.group(2)), month, m.group(4), now), m.span())
    for m in DMY_RE.finditer(text):
        add(_mk_date(int(m.group(1)), MONTHS[m.group(2)[:3].lower()], m.group(3), now), None, m.span())
    for m in MDY_RE.finditer(text):
        add(_mk_date(int(m.group(2)), MONTHS[m.group(1)[:3].lower()], m.group(3), now), None, m.span())
    for m in ISO_RE.finditer(text):
        add(_mk_date(int(m.group(3)), int(m.group(2)), m.group(1), now), None, m.span())
    for m in SLASH_RE.finditer(text):
        add(_mk_date(int(m.group(1)), int(m.group(2)), m.group(3), now), None, m.span())
    return sorted(found, key=lambda f: f[2][0])


def find_times(text):
    times = []
    for m in TIME_RE.finditer(text):
        if m.group(3):
            h, mi, ap = int(m.group(1)), int(m.group(2) or 0), m.group(3).lower()
            if h > 12:
                continue
            h = (h % 12) + (12 if ap == "pm" else 0)
        else:
            h, mi = int(m.group(4)), int(m.group(5))
        times.append(time(h, mi))
    return times


def _iso(d, t):
    return datetime.combine(d, t).isoformat(timespec="minutes")


def _clean_title(line):
    line = re.sub(r"[^\w\s&:'\-\.,()/]", " ", line)
    return re.sub(r"\s+", " ", line).strip(" -:.")[:120]


def extract_with_rules(text, now):
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    deadline_lines = [l for l in lines if DEADLINE_RE.search(l)]
    main_text = "\n".join(l for l in lines if l not in deadline_lines)

    title = ""
    for l in lines:
        if URL_RE.fullmatch(l) or DEADLINE_RE.search(l):
            continue
        cleaned = _clean_title(l)
        if len(cleaned) >= 3:
            title = cleaned
            break

    url_match = URL_RE.search(text)
    url = url_match.group(0).rstrip(".,") if url_match else None
    platform = None
    low = text.lower()
    for key, name in PLATFORMS.items():
        if key in low:
            platform = name
            break
    if not platform:
        via = re.search(r"\bvia\s+([A-Z][A-Za-z0-9]+)", text)
        platform = via.group(1) if via else None

    category = "other"
    for name, pattern in CATEGORIES:
        if re.search(pattern, low):
            category = name
            break

    venue = None
    vm = re.search(r"(?im)^\s*(?:venue|location|where)\s*[:\-]\s*(.+)$", text)
    if vm:
        venue = vm.group(1).strip()[:200]
    else:
        am = re.search(r"(?m)^\s*(?:@|at\s)\s*([A-Z][^\n]{2,80})$", text)
        if am:
            venue = am.group(1).strip()

    dates = find_dates(main_text, now)
    times = find_times(main_text)
    start_at = end_at = None
    if dates:
        d1, d2, _ = dates[0]
        t_start = times[0] if times else time(9, 0)
        t_end = times[1] if len(times) > 1 else None
        start_at = _iso(d1, t_start)
        if d2:
            end_at = _iso(d2, t_end or time(18, 0))
        elif t_end and t_end > t_start:
            end_at = _iso(d1, t_end)

    registration_deadline = None
    stages = []
    for l in deadline_lines:
        dl = find_dates(l, now)
        if dl:
            lt = find_times(l)
            registration_deadline = _iso(dl[0][0], lt[0] if lt else time(23, 59))
            break
    if registration_deadline:
        stages.append({"name": "Register", "due_at": registration_deadline})

    seen = {"Register"}
    for l in lines:
        if l in deadline_lines:
            continue
        for name, pattern in STAGE_KEYWORDS:
            if name in seen or not re.search(pattern, l, re.I):
                continue
            ld = find_dates(l, now)
            if ld and (not dates or ld[0][0] != dates[0][0] or len(lines) == 1):
                lt = find_times(l)
                stages.append({"name": name, "due_at": _iso(ld[0][0], lt[0] if lt else time(23, 59))})
                seen.add(name)

    return {
        "title": title, "platform": platform, "category": category,
        "description": text.strip()[:600], "venue_name": venue,
        "start_at": start_at, "end_at": end_at,
        "registration_deadline": registration_deadline, "url": url,
        "stages": stages, "source": "rules",
    }


LLM_PROMPT = """Extract event details from the text below. Today's date is {today}.
Reply with ONLY a JSON object (no markdown) with these keys:
title, platform (Unstop, Devfolio, etc. or null), category (one of hackathon, workshop, conference, seminar, contest, fest, other),
description (one or two sentences), venue_name, start_at, end_at, registration_deadline (ISO 8601 local time like 2026-10-17T10:00, or null),
url, stages (list of {{"name": "Register|Submit|Shortlist|Results|Round 2", "due_at": ISO 8601}}).
Use null for anything not stated. Do not invent dates. If the year is missing, use the next occurrence of that date.

TEXT:
{text}"""


def _load_json(raw):
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.M).strip()
    start, end = raw.find("{"), raw.rfind("}")
    return json.loads(raw[start:end + 1])


def _valid_iso(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "")).isoformat(timespec="minutes")
    except ValueError:
        return None


def _normalise(data, original_text):
    stages = []
    for s in data.get("stages") or []:
        due = _valid_iso(s.get("due_at"))
        if s.get("name") and due:
            stages.append({"name": str(s["name"])[:100], "due_at": due})
    category = (data.get("category") or "other").lower()
    return {
        "title": (data.get("title") or "")[:200],
        "platform": data.get("platform"),
        "category": category if category in {c[0] for c in CATEGORIES} else "other",
        "description": data.get("description") or original_text.strip()[:600],
        "venue_name": data.get("venue_name"),
        "start_at": _valid_iso(data.get("start_at")),
        "end_at": _valid_iso(data.get("end_at")),
        "registration_deadline": _valid_iso(data.get("registration_deadline")),
        "url": data.get("url"),
        "stages": stages,
        "source": "llm",
    }


def extract_with_llm(text, api_key, model, now):
    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
        json={
            "model": model,
            "max_tokens": 1000,
            "messages": [{"role": "user", "content": LLM_PROMPT.format(today=now.strftime("%A %d %B %Y"), text=text[:6000])}],
        },
        timeout=40,
    )
    resp.raise_for_status()
    out = "".join(b.get("text", "") for b in resp.json().get("content", []) if b.get("type") == "text")
    return _normalise(_load_json(out), text)


def extract_event(text, now, api_key=None, model=None):
    if api_key:
        try:
            return extract_with_llm(text, api_key, model, now)
        except Exception as exc:
            logging.warning("LLM extraction failed, falling back to rules: %s", exc)
    return extract_with_rules(text, now)
