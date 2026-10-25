"""Tests for email forwarding, Google Calendar helpers and calendar clashes (no database needed)."""
import unittest
from datetime import datetime
from email.message import EmailMessage
from unittest import mock

from app.services import google_calendar as gc
from app.ratelimit import Limiter
from app.services import travel
from app.services.conflicts import detect_external_clashes
from app.services.inbox import (build_text, clean_subject, find_token, forwarding_address, html_to_text,
                                parse_raw_email, strip_forward_headers)


class InboxTests(unittest.TestCase):
    def test_token_from_plus_address(self):
        self.assertEqual(find_token("Eventure <inbox+a1b2c3d4e5@gmail.com>"), "a1b2c3d4e5")
        self.assertIsNone(find_token("someone@example.com"))
        self.assertEqual(find_token("x@y.com", "inbox+ABCDEF12@gmail.com"), "abcdef12")

    def test_forwarding_address(self):
        self.assertEqual(forwarding_address("eventure.inbox@gmail.com", "tok123abc"), "eventure.inbox+tok123abc@gmail.com")
        self.assertIsNone(forwarding_address("", "tok"))

    def test_subject_and_forward_banner(self):
        self.assertEqual(clean_subject("Fwd: RE: Hackathon X"), "Hackathon X")
        body = ("---------- Forwarded message ---------\nFrom: Club <c@x.com>\nDate: Mon, 5 Oct 2026\nSubject: Hackathon X\nTo: me\n\n"
                "Venue: Campus A\n17 Oct 2026, 10:00 AM")
        cleaned = strip_forward_headers(body)
        self.assertTrue(cleaned.startswith("Venue: Campus A"))
        self.assertNotIn("Forwarded", cleaned)

    def test_date_line_in_body_is_kept(self):
        self.assertIn("Date: 17 Oct 2026", build_text("Hack", "Date: 17 Oct 2026\nVenue: A"))

    def test_html_to_text(self):
        self.assertEqual(html_to_text("<p>Hello&nbsp;<b>World</b></p><script>x()</script><p>Bye</p>"), "Hello World\nBye")

    def test_parse_raw_plain_email(self):
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"], msg["Message-ID"] = "Club <club@x.com>", "inbox+abcdef1234@gmail.com", "Fwd: Workshop Y", "<1@x>"
        msg.set_content("Venue: DTU\n17 Oct 2026, 2 PM to 5 PM")
        mail = parse_raw_email(msg.as_bytes())
        self.assertEqual(mail["token"], "abcdef1234")
        self.assertEqual(mail["subject"], "Fwd: Workshop Y")
        self.assertEqual(mail["sender"], "club@x.com")
        self.assertIn("Venue: DTU", mail["body"])
        self.assertEqual(mail["message_id"], "<1@x>")

    def test_parse_html_only_email(self):
        msg = EmailMessage()
        msg["To"], msg["Subject"] = "inbox+abcdef1234@gmail.com", "Poster"
        msg.set_content("x")
        msg.clear_content()
        msg.add_alternative("<div>Venue: <b>NSUT</b></div>", subtype="html")
        self.assertIn("Venue: NSUT", parse_raw_email(msg.as_bytes())["body"])


class CalendarClashTests(unittest.TestCase):
    def test_overlap_with_external(self):
        events = [{"id": 1, "title": "Hackathon X", "start": datetime(2026, 10, 17, 10), "end": datetime(2026, 10, 17, 18)}]
        external = [{"title": "Dentist", "start": datetime(2026, 10, 17, 11), "end": datetime(2026, 10, 17, 12)}]
        issues = detect_external_clashes(events, external)
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0]["type"], "calendar_busy")
        self.assertIn("Dentist", issues[0]["message"])

    def test_no_overlap(self):
        events = [{"id": 1, "title": "X", "start": datetime(2026, 10, 17, 10), "end": datetime(2026, 10, 17, 12)}]
        external = [{"title": "Lunch", "start": datetime(2026, 10, 17, 12), "end": datetime(2026, 10, 17, 13)}]
        self.assertEqual(detect_external_clashes(events, external), [])


class GoogleHelperTests(unittest.TestCase):
    TZ = "Asia/Kolkata"

    def test_state_roundtrip(self):
        state = gc.make_state(7, "secret")
        self.assertEqual(gc.read_state(state, "secret"), 7)
        self.assertIsNone(gc.read_state(state, "other"))
        self.assertIsNone(gc.read_state("junk", "secret"))

    def test_filter_external(self):
        items = [
            {"summary": "Dentist", "start": {"dateTime": "2026-10-17T11:00:00+05:30"}, "end": {"dateTime": "2026-10-17T12:00:00+05:30"}},
            {"summary": "Holiday", "start": {"date": "2026-10-17"}, "end": {"date": "2026-10-18"}},
            {"summary": "Ours", "start": {"dateTime": "2026-10-17T11:00:00+05:30"}, "end": {"dateTime": "2026-10-17T12:00:00+05:30"},
             "extendedProperties": {"private": {"eventure": "1"}}},
            {"summary": "FYI", "transparency": "transparent", "start": {"dateTime": "2026-10-17T11:00:00+05:30"}, "end": {"dateTime": "2026-10-17T12:00:00+05:30"}},
            {"summary": "Cancelled", "status": "cancelled", "start": {"dateTime": "2026-10-17T11:00:00+05:30"}, "end": {"dateTime": "2026-10-17T12:00:00+05:30"}},
        ]
        out = gc.filter_external(items, self.TZ)
        self.assertEqual([e["title"] for e in out], ["Dentist"])
        self.assertEqual(out[0]["start"], datetime(2026, 10, 17, 11))

    def test_utc_converted_to_local(self):
        self.assertEqual(gc.from_google("2026-10-17T04:30:00Z", self.TZ), datetime(2026, 10, 17, 10))
        self.assertIsNone(gc.from_google("2026-10-17", self.TZ))

    def test_event_body_is_tagged(self):
        body = gc.event_body({"title": "Hack", "start": datetime(2026, 10, 17, 10), "end": None, "alarm_minutes": 60}, self.TZ)
        self.assertEqual(body["extendedProperties"]["private"], {"eventure": "1"})
        self.assertEqual(body["start"]["timeZone"], self.TZ)
        self.assertEqual(body["reminders"]["overrides"][0]["minutes"], 60)

    def test_auth_url(self):
        url = gc.build_auth_url({"GOOGLE_CLIENT_ID": "cid", "GOOGLE_REDIRECT_URI": "http://x/cb"}, "st")
        self.assertIn("access_type=offline", url)
        self.assertIn("calendar.events", url)


class LimiterTests(unittest.TestCase):
    def test_blocks_after_limit_and_recovers(self):
        lim = Limiter(2, 60)
        self.assertTrue(lim.allow("ip", now=0))
        self.assertTrue(lim.allow("ip", now=1))
        self.assertFalse(lim.allow("ip", now=2))
        self.assertTrue(lim.allow("other", now=2))
        self.assertTrue(lim.allow("ip", now=61))


class FailedAttemptLimiterTests(unittest.TestCase):
    def test_only_recorded_hits_count(self):
        lim = Limiter(2, 60)
        for _ in range(5):
            self.assertFalse(lim.blocked("ip", now=0))  # checking alone never blocks
        lim.hit("ip", now=1)
        self.assertFalse(lim.blocked("ip", now=2))
        lim.hit("ip", now=3)
        self.assertTrue(lim.blocked("ip", now=4))
        self.assertFalse(lim.blocked("ip", now=70))  # window passed


class GeocodeTests(unittest.TestCase):
    def setUp(self):
        travel._nominatim.cache_clear()

    def test_openstreetmap_lookup(self):
        with mock.patch("app.services.travel.requests.get") as get:
            get.return_value.json.return_value = [{"lat": "28.5459", "lon": "77.2732"}]
            self.assertEqual(travel.geocode("IIIT Delhi, Okhla"), (28.5459, 77.2732))

    def test_osm_can_be_switched_off(self):
        with mock.patch("app.services.travel.requests.get") as get:
            self.assertIsNone(travel.geocode("IIIT Delhi", allow_osm=False))
            get.assert_not_called()

    def test_google_used_when_key_present(self):
        with mock.patch("app.services.travel.requests.get") as get:
            get.return_value.json.return_value = {"results": [{"geometry": {"location": {"lat": 1.5, "lng": 2.5}}}]}
            self.assertEqual(travel.geocode("X", api_key="k"), (1.5, 2.5))

    def test_falls_back_to_osm_when_google_finds_nothing(self):
        with mock.patch("app.services.travel.requests.get") as get:
            get.return_value.json.side_effect = [{"results": []}, [{"lat": "3.0", "lon": "4.0"}]]
            self.assertEqual(travel.geocode("Somewhere", api_key="k"), (3.0, 4.0))

    def test_empty_place_and_network_failure(self):
        self.assertIsNone(travel.geocode("   "))
        with mock.patch("app.services.travel.requests.get", side_effect=OSError("down")):
            self.assertIsNone(travel.geocode("Nowhere"))


if __name__ == "__main__":
    unittest.main()
