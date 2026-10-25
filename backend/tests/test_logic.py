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


if __name__ == "__main__":
    unittest.main()
