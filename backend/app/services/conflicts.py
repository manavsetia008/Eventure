"""Clash, travel-gap and exam-week detection. Pure functions on plain dicts.

An event dict looks like:
  {"id": 1, "title": "Hackathon X", "start": datetime, "end": datetime|None,
   "lat": float|None, "lng": float|None, "venue": str|None}
"""
from datetime import timedelta

DEFAULT_DURATION = timedelta(hours=3)
BUFFER_MIN = 15


def effective_end(event):
    return event.get("end") or (event["start"] + DEFAULT_DURATION)


def _different_venues(a, b):
    if None in (a.get("lat"), a.get("lng"), b.get("lat"), b.get("lng")):
        return bool(a.get("venue") and b.get("venue") and a["venue"] != b["venue"])
    return abs(a["lat"] - b["lat"]) > 1e-4 or abs(a["lng"] - b["lng"]) > 1e-4


def _fmt_minutes(m):
    m = int(m)
    if m < 60:
        return f"{m} min"
    h, r = divmod(m, 60)
    return f"{h} h {r} min" if r else f"{h} h"


def detect_issues(events, exam_periods=(), travel_minutes_fn=None):
    """Return a list of issues: overlap, travel_gap, exam_week.

    travel_minutes_fn(a, b) -> minutes or None. exam_periods: [{"label", "start", "end"}] with dates.
    """
    issues = []
    evs = sorted((e for e in events if e.get("start")), key=lambda e: e["start"])

    for i, a in enumerate(evs):
        a_end = effective_end(a)
        for b in evs[i + 1:]:
            if b["start"] > a_end + timedelta(days=1):
                break
            if b["start"] < a_end and a["start"] < effective_end(b):
                overlap = int((min(a_end, effective_end(b)) - b["start"]).total_seconds() // 60)
                issues.append({
                    "type": "overlap",
                    "severity": "high",
                    "events": [a["id"], b["id"]],
                    "message": f"{a['title']} and {b['title']} overlap by {_fmt_minutes(overlap)}.",
                    "meta": {"overlap_minutes": overlap},
                })
                continue
            if b["start"] >= a_end and travel_minutes_fn and _different_venues(a, b):
                travel = travel_minutes_fn(a, b)
                if travel is None:
                    continue
                gap = int((b["start"] - a_end).total_seconds() // 60)
                needed = travel + BUFFER_MIN
                if gap < needed:
                    issues.append({
                        "type": "travel_gap",
                        "severity": "medium",
                        "events": [a["id"], b["id"]],
                        "message": (f"Only {_fmt_minutes(gap)} between {a['title']} and {b['title']}, "
                                    f"but the trip takes about {_fmt_minutes(travel)}."),
                        "meta": {"gap_minutes": gap, "travel_minutes": travel},
                    })

    for e in evs:
        e_start, e_end = e["start"].date(), effective_end(e).date()
        for p in exam_periods:
            if e_start <= p["end"] and p["start"] <= e_end:
                issues.append({
                    "type": "exam_week",
                    "severity": "high",
                    "events": [e["id"]],
                    "message": f"{e['title']} falls in your {p['label']} ({p['start']:%d %b} to {p['end']:%d %b}).",
                    "meta": {"exam": p["label"]},
                })
    return issues


def detect_external_clashes(events, external):
    """Events that overlap something already in the student's own calendar.

    external: [{"title", "start": datetime, "end": datetime}]
    """
    issues = []
    for e in events:
        if not e.get("start"):
            continue
        e_end = effective_end(e)
        for x in external:
            if e["start"] < x["end"] and x["start"] < e_end:
                issues.append({
                    "type": "calendar_busy",
                    "severity": "medium",
                    "events": [e["id"]],
                    "message": f"{e['title']} overlaps \"{x['title']}\" in your calendar ({x['start']:%a %d %b, %H:%M} to {x['end']:%H:%M}).",
                    "meta": {"calendar_title": x["title"]},
                })
                break
    return issues
