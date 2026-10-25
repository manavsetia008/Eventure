"""Priority scoring and keep/skip suggestions. Pure functions on plain dicts.

An item dict:
  {"id", "title", "category", "description", "status", "start": datetime|None,
   "stages": [{"name", "due": datetime|None, "done": bool}],
   "travel_minutes": int|None, "in_exam": bool}
"""
import re
from datetime import timedelta

_WORD = re.compile(r"[a-z0-9]+")

PART_LABELS = {
    "goal": "fits your goals better",
    "urgency": "has the nearer deadline",
    "effort": "is easier to reach",
    "progress": "you are already registered",
    "exam": "the other one falls in exam time",
}


def _tokens(text):
    return set(_WORD.findall((text or "").lower()))


def goal_fit(goals, category, title, description):
    goal_tokens = set()
    for g in goals:
        goal_tokens |= _tokens(g)
    if not goal_tokens:
        return 20, []  # no goals set: neutral
    score, reasons = 0, []
    cat_tokens = _tokens(category)
    if cat_tokens & goal_tokens:
        score += 25
        reasons.append(f"matches your goal ({category})")
    hits = (goal_tokens & _tokens(f"{title} {description}")) - cat_tokens
    if hits:
        score += 15 * min(len(hits), 2)
        reasons.append("mentions " + ", ".join(sorted(hits)[:2]))
    return min(score, 40), reasons


def _urgency(item, now):
    due = [s["due"] for s in item.get("stages", []) if s.get("due") and not s.get("done") and s["due"] >= now]
    ref = min(due) if due else None
    if ref is None and item.get("start") and item["start"] >= now:
        ref = item["start"]
    if ref is None:
        return 0
    if ref - now <= timedelta(hours=48):
        return 20
    if ref - now <= timedelta(days=7):
        return 12
    return 5


def _effort(minutes):
    if minutes is None:
        return 10
    if minutes <= 30:
        return 20
    if minutes <= 60:
        return 14
    if minutes <= 120:
        return 8
    return 2


def score_item(item, goals, now):
    goal, goal_reasons = goal_fit(goals, item.get("category"), item.get("title"), item.get("description"))
    parts = {
        "goal": goal,
        "urgency": _urgency(item, now),
        "effort": _effort(item.get("travel_minutes")),
        "progress": 10 if item.get("status") == "registered" else 0,
        "exam": -25 if item.get("in_exam") else 0,
    }
    total = max(0, min(100, sum(parts.values())))
    return {"score": total, "parts": parts, "reasons": goal_reasons}


def suggest_between(a, a_score, b, b_score, between_minutes=None):
    """Which of two clashing events to keep."""
    if a_score["score"] >= b_score["score"]:
        keep, keep_s, skip, skip_s = a, a_score, b, b_score
    else:
        keep, keep_s, skip, skip_s = b, b_score, a, a_score

    diffs = {}
    for k in ("goal", "urgency", "effort", "progress"):
        diffs[k] = keep_s["parts"][k] - skip_s["parts"][k]
    if skip_s["parts"]["exam"] < keep_s["parts"]["exam"]:
        diffs["exam"] = keep_s["parts"]["exam"] - skip_s["parts"]["exam"]
    best = max(diffs, key=diffs.get)

    if keep_s["score"] == skip_s["score"] or diffs[best] <= 0:
        reason = f"Keep {keep['title']}: the two score about the same, so pick the one you care about more."
    else:
        reason = f"Keep {keep['title']}: it {PART_LABELS[best]}." if best != "progress" and best != "exam" else (
            f"Keep {keep['title']}: {PART_LABELS[best]}."
        )
        if best == "goal" and keep_s["reasons"]:
            reason = f"Keep {keep['title']}: it {keep_s['reasons'][0]}."
    if between_minutes:
        reason += f" Getting to {skip['title']} adds {between_minutes} min."
    return {
        "action": "keep",
        "keep": keep["id"],
        "skip": skip["id"],
        "keep_title": keep["title"],
        "skip_title": skip["title"],
        "reason": reason,
    }


def suggest_for_exam(item, item_score, exam_label):
    worth_it = item_score["score"] >= 55
    if worth_it:
        reason = f"{item['title']} scores {item_score['score']} for you, so it may be worth keeping. Plan your {exam_label} prep around it."
        return {"action": "keep", "keep": item["id"], "skip": None, "keep_title": item["title"], "skip_title": None, "reason": reason}
    reason = f"{item['title']} scores only {item_score['score']} for you and lands in your {exam_label}. Consider skipping it."
    return {"action": "skip", "keep": None, "skip": item["id"], "keep_title": None, "skip_title": item["title"], "reason": reason}
