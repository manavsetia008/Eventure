"""Tests for the pure logic (no database needed). Run: python -m unittest discover -s tests -v"""
import unittest
from datetime import date, datetime

from app.services.conflicts import detect_issues
from app.services.extraction import extract_with_rules, find_dates, find_times
from app.services.ics import build_ics
from app.services.priority import score_item, suggest_between, suggest_for_exam
from app.services.reminders import compute_reminders, level_for
from app.services.travel import estimate_minutes, haversine_km

NOW = datetime(2026, 10, 12, 9, 0)


def ev(i, title, start, end, lat=None, lng=None, venue=None):
    return {"id": i, "title": title, "start": start, "end": end, "lat": lat, "lng": lng, "venue": venue}


class ConflictTests(unittest.TestCase):
    def test_overlap(self):
        a = ev(1, "Hackathon X", datetime(2026, 10, 17, 10), datetime(2026, 10, 17, 18))
        b = ev(2, "Workshop Y", datetime(2026, 10, 17, 14), datetime(2026, 10, 17, 17))
        issues = detect_issues([a, b])
        self.assertEqual([i["type"] for i in issues], ["overlap"])
        self.assertEqual(issues[0]["meta"]["overlap_minutes"], 180)

    def test_no_issue_when_far_apart(self):
        a = ev(1, "A", datetime(2026, 10, 17, 10), datetime(2026, 10, 17, 12))
        b = ev(2, "B", datetime(2026, 10, 20, 10), datetime(2026, 10, 20, 12))
        self.assertEqual(detect_issues([a, b]), [])

    def test_travel_gap(self):
        a = ev(1, "A", datetime(2026, 10, 17, 10), datetime(2026, 10, 17, 12), 28.54, 77.27, "IIIT")
        b = ev(2, "B", datetime(2026, 10, 17, 12, 30), datetime(2026, 10, 17, 15), 28.75, 77.11, "DTU")
        issues = detect_issues([a, b], travel_minutes_fn=lambda x, y: 70)
        self.assertEqual(issues[0]["type"], "travel_gap")
        self.assertEqual(issues[0]["meta"]["gap_minutes"], 30)

    def test_same_venue_no_travel_issue(self):
        a = ev(1, "A", datetime(2026, 10, 17, 10), datetime(2026, 10, 17, 12), 28.5, 77.2, "IIIT")
        b = ev(2, "B", datetime(2026, 10, 17, 12, 5), datetime(2026, 10, 17, 14), 28.5, 77.2, "IIIT")
        self.assertEqual(detect_issues([a, b], travel_minutes_fn=lambda x, y: 70), [])

    def test_exam_week(self):
        a = ev(1, "Contest Z", datetime(2026, 10, 21, 10), None)
        exams = [{"label": "sessionals", "start": date(2026, 10, 19), "end": date(2026, 10, 23)}]
        issues = detect_issues([a], exams)
        self.assertEqual(issues[0]["type"], "exam_week")


class PriorityTests(unittest.TestCase):
    def item(self, i, title, category, **kw):
        base = {"id": i, "title": title, "category": category, "description": "", "status": "interested",
                "start": datetime(2026, 10, 17, 10), "stages": [], "travel_minutes": None, "in_exam": False}
        base.update(kw)
        return base

    def test_goal_fit_wins(self):
        a = self.item(1, "Hackathon X", "hackathon")
        b = self.item(2, "Workshop Y", "workshop")
        sa, sb = score_item(a, ["hackathon"], NOW), score_item(b, ["hackathon"], NOW)
        self.assertGreater(sa["score"], sb["score"])
        s = suggest_between(a, sa, b, sb, between_minutes=70)
        self.assertEqual((s["keep"], s["skip"]), (1, 2))
        self.assertIn("70 min", s["reason"])
        self.assertIn("Hackathon X", s["reason"])

    def test_exam_penalty(self):
        a = self.item(1, "X", "hackathon", in_exam=True)
        self.assertLess(score_item(a, ["hackathon"], NOW)["parts"]["exam"], 0)

    def test_exam_suggestion_skips_low_score(self):
        a = self.item(1, "Contest Z", "contest", in_exam=True, travel_minutes=150)
        s = suggest_for_exam(a, score_item(a, ["hackathon"], NOW), "sessionals")
        self.assertEqual(s["action"], "skip")

    def test_score_is_bounded(self):
        a = self.item(1, "Hackathon AI", "hackathon", status="registered", travel_minutes=10,
                      stages=[{"name": "Submit", "due": datetime(2026, 10, 13), "done": False}])
        self.assertLessEqual(score_item(a, ["hackathon", "ai"], NOW)["score"], 100)


class ExtractionTests(unittest.TestCase):
    TEXT = """HackShift 2026 - Hackathon
Venue: IIIT Delhi, Okhla
17-18 Oct 2026, 10:00 AM to 6:00 PM
Registrations close 12 Oct 2026
Register on https://unstop.com/hackathons/hackshift
Results on 25 Oct 2026"""

    def test_rules_parser(self):
        r = extract_with_rules(self.TEXT, NOW)
        self.assertEqual(r["title"], "HackShift 2026 - Hackathon")
        self.assertEqual(r["category"], "hackathon")
        self.assertEqual(r["platform"], "Unstop")
        self.assertEqual(r["venue_name"], "IIIT Delhi, Okhla")
        self.assertEqual(r["start_at"], "2026-10-17T10:00")
        self.assertEqual(r["end_at"], "2026-10-18T18:00")
        self.assertEqual(r["registration_deadline"], "2026-10-12T23:59")
        names = [s["name"] for s in r["stages"]]
        self.assertIn("Register", names)
        self.assertIn("Results", names)

    def test_year_inferred(self):
        d = find_dates("Workshop on 5 Nov", NOW)
        self.assertEqual(d[0][0], date(2026, 11, 5))

    def test_year_rolls_over(self):
        d = find_dates("Contest on 5 Jan", NOW)
        self.assertEqual(d[0][0], date(2027, 1, 5))

    def test_times(self):
        self.assertEqual([t.hour for t in find_times("10 AM to 6 PM")], [10, 18])
        self.assertEqual([t.hour for t in find_times("Sat 10:00 to 18:00")], [10, 18])

    def test_marketing_not_a_month(self):
        self.assertEqual(find_dates("10 Marketing sessions", NOW), [])


class ReminderTests(unittest.TestCase):
    def test_levels(self):
        self.assertIsNone(level_for(72))
        self.assertEqual(level_for(40), "warning")
        self.assertEqual(level_for(20), "urgent")
        self.assertEqual(level_for(3), "critical")
        self.assertEqual(level_for(-5), "critical")
        self.assertIsNone(level_for(-30))

    def test_compute(self):
        stages = [
            {"id": 1, "user_id": 1, "event_title": "Hackathon X", "name": "Submit", "due_at": datetime(2026, 10, 14, 9), "done": False, "status": "registered"},
            {"id": 2, "user_id": 1, "event_title": "Y", "name": "Register", "due_at": datetime(2026, 10, 14, 9), "done": True, "status": "registered"},
            {"id": 3, "user_id": 1, "event_title": "Z", "name": "Register", "due_at": datetime(2026, 10, 14, 9), "done": False, "status": "skipped"},
        ]
        out = compute_reminders(stages, NOW + (datetime(2026, 10, 12, 9) - NOW))
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["level"], "warning")
        self.assertEqual(out[0]["key"], "stage:1:warning")


class TravelAndIcsTests(unittest.TestCase):
    def test_haversine_zero(self):
        self.assertAlmostEqual(haversine_km(28.5, 77.2, 28.5, 77.2), 0.0, places=3)

    def test_estimate(self):
        self.assertIsNone(estimate_minutes(None, None, 1, 1))
        self.assertEqual(estimate_minutes(28.5, 77.2, 28.5, 77.2), 0)
        self.assertGreater(estimate_minutes(28.5459, 77.2732, 28.75, 77.117), 30)

    def test_ics(self):
        text = build_ics([{"uid": "1", "title": "Hack, X; Y", "start": datetime(2026, 10, 17, 10), "end": None,
                           "location": "IIIT", "description": "line1\nline2", "alarm_minutes": 60}])
        self.assertIn("BEGIN:VEVENT", text)
        self.assertIn("SUMMARY:Hack\\, X\\; Y", text)
        self.assertIn("DTSTART:20261017T100000", text)
        self.assertTrue(text.endswith("END:VCALENDAR\r\n"))


# ─── OCR preprocessing (unit tests that don't need Tesseract) ───────────────
class OcrPreprocessTests(unittest.TestCase):
    """Test _preprocess without calling Tesseract."""

    def _preprocess(self, img):
        from app.services.ocr import _preprocess
        return _preprocess(img)

    def test_greyscale_output(self):
        from PIL import Image
        img = Image.new("RGB", (200, 200), color=(200, 100, 50))
        out = self._preprocess(img)
        # binarised mode is "1" (black-and-white)
        self.assertEqual(out.mode, "1")

    def test_small_image_upscaled(self):
        from PIL import Image
        img = Image.new("L", (100, 80), color=200)
        out = self._preprocess(img)
        self.assertGreaterEqual(max(out.size), 800)

    def test_large_image_not_upscaled(self):
        from PIL import Image
        img = Image.new("L", (1200, 900), color=200)
        out = self._preprocess(img)
        # width must stay 1200 — no downscaling
        self.assertEqual(out.size[0], 1200)


# ─── Additional conflict edge cases ─────────────────────────────────────────
class ConflictEdgeTests(unittest.TestCase):
    def ev(self, i, title, start, end=None, lat=None, lng=None, venue=None):
        return {"id": i, "title": title, "start": start, "end": end,
                "lat": lat, "lng": lng, "venue": venue}

    def test_exact_boundary_no_overlap(self):
        """Event B starts exactly when A ends — not an overlap."""
        a = self.ev(1, "A", datetime(2026, 11, 1, 10), datetime(2026, 11, 1, 12))
        b = self.ev(2, "B", datetime(2026, 11, 1, 12), datetime(2026, 11, 1, 14))
        self.assertEqual(detect_issues([a, b]), [])

    def test_single_event_no_issue(self):
        a = self.ev(1, "Solo", datetime(2026, 11, 1, 10), datetime(2026, 11, 1, 12))
        self.assertEqual(detect_issues([a]), [])

    def test_exam_does_not_flag_past_event(self):
        """An event that ended before the exam period should not be flagged."""
        a = self.ev(1, "Old Event", datetime(2026, 10, 1, 10), datetime(2026, 10, 1, 12))
        exams = [{"label": "mid-sems", "start": date(2026, 10, 19), "end": date(2026, 10, 24)}]
        issues = detect_issues([a], exams)
        self.assertEqual(issues, [])

    def test_multiple_exam_periods_only_one_flagged(self):
        """Only the period that overlaps is flagged."""
        a = self.ev(1, "Contest", datetime(2026, 10, 21, 10), datetime(2026, 10, 21, 18))
        exams = [
            {"label": "mid-sems", "start": date(2026, 10, 19), "end": date(2026, 10, 24)},
            {"label": "end-sems", "start": date(2026, 11, 20), "end": date(2026, 11, 28)},
        ]
        issues = detect_issues([a], exams)
        exam_issues = [i for i in issues if i["type"] == "exam_week"]
        self.assertEqual(len(exam_issues), 1)
        self.assertIn("mid-sems", exam_issues[0]["message"])


# ─── Additional priority edge cases ──────────────────────────────────────────
class PriorityEdgeTests(unittest.TestCase):
    NOW = datetime(2026, 10, 12, 9, 0)

    def _item(self, i, title, category="hackathon", **kw):
        base = {"id": i, "title": title, "category": category, "description": "",
                "status": "interested", "start": datetime(2026, 10, 17, 10),
                "stages": [], "travel_minutes": None, "in_exam": False}
        base.update(kw)
        return base

    def test_score_never_negative(self):
        """Even with exam penalty and long travel, score must be >= 0."""
        a = self._item(1, "X", in_exam=True, travel_minutes=300)
        s = score_item(a, [], self.NOW)
        self.assertGreaterEqual(s["score"], 0)

    def test_no_goals_gives_neutral_goal_score(self):
        a = self._item(1, "Y")
        s = score_item(a, [], self.NOW)
        # goal part should be the neutral 20 when no goals are set
        self.assertEqual(s["parts"]["goal"], 20)

    def test_registered_status_adds_progress_points(self):
        a = self._item(1, "Z", status="registered")
        b = self._item(2, "Z", status="interested")
        sa = score_item(a, [], self.NOW)
        sb = score_item(b, [], self.NOW)
        self.assertGreater(sa["score"], sb["score"])

    def test_suggest_between_equal_scores_gives_message(self):
        a = self._item(1, "Alpha")
        b = self._item(2, "Beta")
        sa = sb = score_item(a, [], self.NOW)  # both identical
        result = suggest_between(a, sa, b, sb)
        self.assertIn("Alpha", result["reason"])

    def test_exam_keep_when_high_score(self):
        """High-priority event in exam week should still suggest 'keep'."""
        a = self._item(1, "AI Hackathon", category="hackathon",
                       status="registered", travel_minutes=10,
                       stages=[{"name": "Submit", "due": datetime(2026, 10, 13), "done": False}])
        s = score_item(a, ["hackathon", "ai"], self.NOW)
        # registered + urgency + goal fit should push score above 55 despite exam penalty
        a_exam = self._item(1, "AI Hackathon", category="hackathon",
                            status="registered", travel_minutes=10, in_exam=False,
                            stages=[{"name": "Submit", "due": datetime(2026, 10, 13), "done": False}])
        s_high = score_item(a_exam, ["hackathon", "ai"], self.NOW)
        result = suggest_for_exam(a_exam, s_high, "mid-sems")
        self.assertEqual(result["action"], "keep")


# ─── Travel edge cases ───────────────────────────────────────────────────────
class TravelEdgeTests(unittest.TestCase):
    def test_same_point_returns_zero(self):
        self.assertEqual(estimate_minutes(28.5459, 77.2732, 28.5459, 77.2732), 0)

    def test_missing_one_coord_returns_none(self):
        self.assertIsNone(estimate_minutes(28.5, None, 28.7, 77.2))
        self.assertIsNone(estimate_minutes(None, 77.2, 28.7, 77.2))

    def test_delhi_to_gurgaon_reasonable(self):
        # IIIT Delhi → Cyber Hub Gurgaon: ~20–50 km, should be 30–90 min
        mins = estimate_minutes(28.5459, 77.2732, 28.4950, 77.0890)
        self.assertIsNotNone(mins)
        self.assertGreater(mins, 20)
        self.assertLess(mins, 120)

    def test_haversine_known_distance(self):
        # Delhi to Mumbai: roughly 1150 km straight line
        km = haversine_km(28.6, 77.2, 19.07, 72.87)
        self.assertGreater(km, 1000)
        self.assertLess(km, 1400)


if __name__ == "__main__":
    unittest.main()
