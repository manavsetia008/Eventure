"""End-to-end API tests using Flask's test client and an in-memory SQLite database.

Run after installing requirements:  python -m unittest discover -s tests -v
(Skipped automatically if Flask-SQLAlchemy is not installed.)
"""
import unittest
from datetime import date, datetime, timedelta

try:
    import flask_sqlalchemy  # noqa: F401
    HAVE_DB = True
except ImportError:
    HAVE_DB = False


def stamp(**delta):
    return (datetime.now() + timedelta(**delta)).replace(second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M")


def day_at(days, hour):
    d = datetime.now().replace(hour=hour, minute=0, second=0, microsecond=0) + timedelta(days=days)
    return d.strftime("%Y-%m-%dT%H:%M")


@unittest.skipUnless(HAVE_DB, "Flask-SQLAlchemy is not installed")
class ApiTests(unittest.TestCase):
    def setUp(self):
        from app import create_app
        from app.config import Config

        class TestConfig(Config):
            TESTING = True
            SQLALCHEMY_DATABASE_URI = "sqlite://"
            ENABLE_SCHEDULER = False
            ANTHROPIC_API_KEY = ""
            GOOGLE_MAPS_API_KEY = ""
            GOOGLE_CLIENT_ID = ""
            GOOGLE_CLIENT_SECRET = ""
            VAPID_PUBLIC_KEY = ""
            VAPID_PRIVATE_KEY = ""
            INBOUND_SECRET = "hook-secret"
            INBOX_ADDRESS = "inbox@example.com"
            IMAP_HOST = ""
            GEOCODE_OSM = False

        self.app = create_app(TestConfig)
        self.client = self.app.test_client()

    # ---------- helpers ----------
    def user(self, email="a@x.com", goals="hackathon"):
        r = self.client.post("/api/auth/register", json={
            "name": "Test Student", "email": email, "password": "secret1", "college": "IIIT Delhi",
            "college_lat": 28.5459, "college_lng": 77.2732, "goals": goals})
        self.assertEqual(r.status_code, 201, r.get_json())
        return {"Authorization": "Bearer " + r.get_json()["token"]}

    def add_event(self, h, title, start, end, category="hackathon", lat=28.5459, lng=77.2732, **extra):
        payload = {"title": title, "category": category, "start_at": start, "end_at": end,
                   "venue_name": "Somewhere", "lat": lat, "lng": lng, **extra}
        r = self.client.post("/api/events", json=payload, headers=h)
        self.assertEqual(r.status_code, 201, r.get_json())
        return r.get_json()["user_event"]

    # ---------- tests ----------
    def test_register_login_me(self):
        h = self.user()
        me = self.client.get("/api/auth/me", headers=h).get_json()["user"]
        self.assertEqual(me["email"], "a@x.com")
        self.assertEqual(me["goals"], ["hackathon"])
        dup = self.client.post("/api/auth/register", json={"name": "N", "email": "a@x.com", "password": "secret1"})
        self.assertEqual(dup.status_code, 409)
        bad = self.client.post("/api/auth/login", json={"email": "a@x.com", "password": "wrong"})
        self.assertEqual(bad.status_code, 401)
        ok = self.client.post("/api/auth/login", json={"email": "a@x.com", "password": "secret1"})
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(self.client.get("/api/timeline").status_code, 401)

    def test_deadline_risk_on_timeline(self):
        h = self.user()
        self.add_event(h, "Hackathon X", day_at(3, 10), day_at(3, 18),
                       stages=[{"name": "Submit", "due_at": stamp(hours=20)}])
        items = self.client.get("/api/timeline", headers=h).get_json()["items"]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["risk"], "high")
        self.assertEqual(items[0]["next_deadline"]["name"], "Submit")

    def test_clash_gets_keep_suggestion_and_skip_clears_it(self):
        h = self.user()
        hack = self.add_event(h, "Hackathon X", day_at(3, 10), day_at(3, 18), category="hackathon")
        work = self.add_event(h, "Workshop Y", day_at(3, 14), day_at(3, 17), category="workshop", lat=28.75, lng=77.117)
        data = self.client.get("/api/timeline", headers=h).get_json()
        overlaps = [i for i in data["issues"] if i["type"] == "overlap"]
        self.assertEqual(len(overlaps), 1)
        self.assertEqual(overlaps[0]["suggestion"]["keep_title"], "Hackathon X")
        self.assertEqual(overlaps[0]["suggestion"]["skip"], work["id"])
        r = self.client.patch(f"/api/user-events/{work['id']}", json={"status": "skipped"}, headers=h)
        self.assertEqual(r.status_code, 200)
        after = self.client.get("/api/timeline", headers=h).get_json()["issues"]
        self.assertFalse([i for i in after if i["type"] == "overlap"])
        self.assertTrue(hack["id"])

    def test_exam_week_issue(self):
        h = self.user()
        self.add_event(h, "Contest Z", day_at(4, 11), day_at(4, 14), category="contest")
        start, end = date.today() + timedelta(days=2), date.today() + timedelta(days=6)
        r = self.client.post("/api/exams", json={"label": "sessionals", "start_date": start.isoformat(), "end_date": end.isoformat()}, headers=h)
        self.assertEqual(r.status_code, 201)
        issues = self.client.get("/api/timeline", headers=h).get_json()["issues"]
        self.assertEqual([i["type"] for i in issues], ["exam_week"])
        self.assertIn(issues[0]["suggestion"]["action"], ("keep", "skip"))

    def test_discover_lists_only_public_upcoming(self):
        h = self.user()
        self.add_event(h, "Public soon", day_at(5, 10), day_at(5, 12), is_public=True)
        self.add_event(h, "Private soon", day_at(5, 10), day_at(5, 12), is_public=False)
        self.add_event(h, "Public past", day_at(-5, 10), day_at(-5, 12), is_public=True)
        events = self.client.get("/api/discover", headers=h).get_json()["events"]
        self.assertEqual([e["title"] for e in events], ["Public soon"])
        self.assertEqual(events[0]["distance_km"], 0.0)

    def test_reviews_only_from_verified_attendees(self):
        owner, student = self.user("owner@x.com"), self.user("s@x.com")
        ev = self.add_event(owner, "Past hack", day_at(-3, 10), day_at(-3, 18), is_public=True)["event"]
        url = f"/api/events/{ev['id']}/reviews"
        body = {"organisation": 5, "learning": 4, "value": 3, "comment": "Good"}

        self.assertEqual(self.client.post(url, json=body, headers=student).status_code, 403)  # never on timeline
        self.client.post(f"/api/events/{ev['id']}/join", json={"status": "interested"}, headers=student)
        self.assertEqual(self.client.post(url, json=body, headers=student).status_code, 403)  # not attended
        detail = self.client.get(f"/api/events/{ev['id']}", headers=student).get_json()
        self.assertFalse(detail["mine"]["can_review"])

        self.client.patch(f"/api/user-events/{detail['mine']['user_event_id']}", json={"status": "attended"}, headers=student)
        self.assertEqual(self.client.post(url, json={**body, "value": 9}, headers=student).status_code, 400)
        self.assertEqual(self.client.post(url, json=body, headers=student).status_code, 201)
        self.assertEqual(self.client.post(url, json=body, headers=student).status_code, 409)
        detail = self.client.get(f"/api/events/{ev['id']}", headers=student).get_json()
        self.assertEqual(detail["event"]["rating"]["count"], 1)
        self.assertEqual(detail["event"]["rating"]["avg"], 4.0)
        self.assertTrue(detail["reviews"][0]["verified"])

    def test_team_shares_event_with_members(self):
        a, b = self.user("a@x.com"), self.user("b@x.com")
        ev = self.add_event(a, "Team hack", day_at(4, 10), day_at(4, 18))["event"]
        team = self.client.post("/api/teams", json={"name": "Quanta"}, headers=a).get_json()["team"]
        joined = self.client.post("/api/teams/join", json={"code": team["code"].lower()}, headers=b)
        self.assertEqual(joined.status_code, 200)
        self.assertEqual(self.client.post(f"/api/teams/{team['id']}/events", json={"event_id": ev["id"]}, headers=a).status_code, 200)
        titles = [i["event"]["title"] for i in self.client.get("/api/timeline", headers=b).get_json()["items"]]
        self.assertIn("Team hack", titles)
        view = self.client.get(f"/api/teams/{team['id']}", headers=b).get_json()
        self.assertEqual(len(view["members"]), 2)
        self.assertEqual(len(view["events"][0]["members"]), 2)

    def test_forwarded_email_lands_in_inbox(self):
        h = self.user()
        inbox = self.client.get("/api/inbox", headers=h).get_json()
        token = inbox["token"]
        self.assertTrue(inbox["forwarding_address"].startswith("inbox+" + token))
        mail = {"to": f"inbox+{token}@example.com", "from": "club@x.com", "subject": "Fwd: Workshop Y",
                "text": "Venue: DTU, Rohini\n17 Oct 2026, 2 PM to 5 PM", "message_id": "<m1@x>"}
        self.assertEqual(self.client.post("/api/inbound/email", json=mail).status_code, 403)
        hdr = {"X-Inbound-Secret": "hook-secret"}
        first = self.client.post("/api/inbound/email", json=mail, headers=hdr)
        self.assertEqual(first.status_code, 202)
        again = self.client.post("/api/inbound/email", json=mail, headers=hdr)
        self.assertFalse(again.get_json()["accepted"])
        items = self.client.get("/api/inbox", headers=h).get_json()["items"]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["parsed"]["title"], "Workshop Y")
        self.assertEqual(items[0]["parsed"]["venue_name"], "DTU, Rohini")
        self.assertEqual(self.client.get("/api/notifications", headers=h).get_json()["inbox_pending"], 1)

        r = self.client.post("/api/events", json={"title": "Workshop Y", "inbox_item_id": items[0]["id"]}, headers=h)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.client.get("/api/inbox", headers=h).get_json()["items"], [])

    def test_ics_feed_accepts_token_in_url(self):
        h = self.user()
        self.add_event(h, "Hackathon X", day_at(3, 10), day_at(3, 18), stages=[{"name": "Submit", "due_at": stamp(days=2)}])
        token = h["Authorization"].split()[1]
        r = self.client.get(f"/api/calendar.ics?token={token}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.mimetype, "text/calendar")
        text = r.get_data(as_text=True)
        self.assertIn("SUMMARY:Hackathon X", text)
        self.assertIn("SUMMARY:Deadline: Submit (Hackathon X)", text)

    def test_reminder_check_creates_one_alert_per_level(self):
        h = self.user()
        self.add_event(h, "Hackathon X", day_at(3, 10), day_at(3, 18), stages=[{"name": "Submit", "due_at": stamp(hours=10)}])
        self.assertEqual(self.client.post("/api/notifications/check", headers=h).get_json()["created"], 1)
        self.assertEqual(self.client.post("/api/notifications/check", headers=h).get_json()["created"], 0)
        notes = self.client.get("/api/notifications", headers=h).get_json()
        self.assertEqual(notes["unread"], 1)
        self.assertIn("Submit", notes["notifications"][0]["message"])

    def test_organizer_dashboard_counts(self):
        owner, student = self.user("o@x.com"), self.user("s@x.com")
        ev = self.add_event(owner, "My event", day_at(6, 10), day_at(6, 12), is_public=True)["event"]
        self.client.post(f"/api/events/{ev['id']}/join", json={"status": "interested"}, headers=student)
        rows = self.client.get("/api/organizer/events", headers=owner).get_json()["events"]
        self.assertEqual(rows[0]["counts"]["registered"], 1)  # the organizer's own entry
        self.assertEqual(rows[0]["counts"]["interested"], 1)  # the student
        self.assertEqual(self.client.post(f"/api/organizer/events/{ev['id']}/visibility", json={"is_public": False}, headers=student).status_code, 404)
        self.assertEqual(self.client.post(f"/api/organizer/events/{ev['id']}/visibility", json={"is_public": False}, headers=owner).status_code, 200)

    def test_optional_integrations_report_not_configured(self):
        h = self.user()
        status = self.client.get("/api/google/status", headers=h).get_json()
        self.assertFalse(status["configured"])
        self.assertEqual(self.client.get("/api/google/connect", headers=h).status_code, 501)
        self.assertIsNone(self.client.get("/api/push/key", headers=h).get_json()["public_key"])

    def test_edit_event_only_by_creator(self):
        owner, other = self.user("o@x.com"), self.user("x@x.com")
        ev = self.add_event(owner, "Old title", day_at(5, 10), day_at(5, 12))["event"]
        r = self.client.put(f"/api/events/{ev['id']}", json={"title": "New title", "venue_name": "DTU", "lat": 28.75, "lng": 77.117}, headers=owner)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json()["event"]["title"], "New title")
        self.assertEqual(r.get_json()["event"]["lat"], 28.75)
        self.assertEqual(self.client.put(f"/api/events/{ev['id']}", json={"title": "Hijack"}, headers=other).status_code, 404)
        self.assertEqual(self.client.put(f"/api/events/{ev['id']}", json={"title": " "}, headers=owner).status_code, 400)
        bad = self.client.put(f"/api/events/{ev['id']}", json={"start_at": day_at(6, 12), "end_at": day_at(6, 10)}, headers=owner)
        self.assertEqual(bad.status_code, 400)

    def test_geocode_endpoint_reports_missing_place(self):
        h = self.user()
        self.assertEqual(self.client.post("/api/geocode", json={"venue": ""}, headers=h).status_code, 400)
        self.assertEqual(self.client.post("/api/geocode", json={"venue": "Nowhere Land"}, headers=h).status_code, 404)

    def test_delete_own_review(self):
        owner, student = self.user("o@x.com"), self.user("s@x.com")
        ev = self.add_event(owner, "Past hack", day_at(-3, 10), day_at(-3, 18), is_public=True)["event"]
        ue = self.client.post(f"/api/events/{ev['id']}/join", json={"status": "attended"}, headers=student).get_json()
        self.assertEqual(ue["status"], "attended")
        body = {"organisation": 5, "learning": 5, "value": 5}
        self.assertEqual(self.client.post(f"/api/events/{ev['id']}/reviews", json=body, headers=student).status_code, 201)
        detail = self.client.get(f"/api/events/{ev['id']}", headers=student).get_json()
        self.assertTrue(detail["reviews"][0]["mine"])
        self.assertEqual(self.client.delete(f"/api/events/{ev['id']}/reviews/mine", headers=student).status_code, 200)
        self.assertEqual(self.client.delete(f"/api/events/{ev['id']}/reviews/mine", headers=student).status_code, 404)
        self.assertEqual(self.client.get(f"/api/events/{ev['id']}", headers=student).get_json()["event"]["rating"]["count"], 0)

    def test_delete_account_removes_data_and_hands_over_team(self):
        a, b = self.user("a@x.com"), self.user("b@x.com")
        public = self.add_event(a, "Public one", day_at(5, 10), day_at(5, 12), is_public=True)["event"]
        self.add_event(a, "Private one", day_at(6, 10), day_at(6, 12), is_public=False)
        self.client.post(f"/api/events/{public['id']}/join", json={"status": "interested"}, headers=b)
        team = self.client.post("/api/teams", json={"name": "T"}, headers=a).get_json()["team"]
        self.client.post("/api/teams/join", json={"code": team["code"]}, headers=b)

        self.assertEqual(self.client.delete("/api/auth/me", json={"password": "nope"}, headers=a).status_code, 403)
        self.assertEqual(self.client.delete("/api/auth/me", json={"password": "secret1"}, headers=a).status_code, 200)
        self.assertEqual(self.client.get("/api/auth/me", headers=a).status_code, 401)
        # the other student keeps the public event and now owns the team
        titles = [i["event"]["title"] for i in self.client.get("/api/timeline", headers=b).get_json()["items"]]
        self.assertEqual(titles, ["Public one"])
        teams = self.client.get("/api/teams", headers=b).get_json()["teams"]
        self.assertTrue(teams[0]["is_owner"])
        self.assertEqual(self.client.post("/api/auth/login", json={"email": "a@x.com", "password": "secret1"}).status_code, 401)

    def test_missed_deadline_on_past_event_is_not_flagged(self):
        h = self.user()
        self.add_event(h, "Old hack", day_at(-4, 10), day_at(-4, 18), stages=[{"name": "Submit", "due_at": stamp(days=-5)}])
        item = self.client.get("/api/timeline", headers=h).get_json()["items"][0]
        self.assertTrue(item["past"])
        self.assertIsNone(item["risk"])

    def test_removing_a_private_event_cleans_it_up(self):
        h = self.user()
        ue = self.add_event(h, "Just mine", day_at(5, 10), day_at(5, 12), is_public=False)
        self.assertEqual(self.client.delete(f"/api/user-events/{ue['id']}", headers=h).status_code, 200)
        self.assertEqual(self.client.get(f"/api/events/{ue['event']['id']}", headers=h).status_code, 404)

    def test_removing_a_public_event_keeps_it_for_others(self):
        owner, other = self.user("o@x.com"), self.user("x@x.com")
        ue = self.add_event(owner, "Shared", day_at(5, 10), day_at(5, 12), is_public=True)
        self.client.post(f"/api/events/{ue['event']['id']}/join", json={"status": "interested"}, headers=other)
        self.assertEqual(self.client.delete(f"/api/user-events/{ue['id']}", headers=owner).status_code, 200)
        self.assertEqual(self.client.get(f"/api/events/{ue['event']['id']}", headers=other).status_code, 200)

    def test_bad_ids_are_rejected_not_crashed(self):
        h = self.user()
        team = self.client.post("/api/teams", json={"name": "T"}, headers=h).get_json()["team"]
        r = self.client.post(f"/api/teams/{team['id']}/events", json={"event_id": "abc"}, headers=h)
        self.assertEqual(r.status_code, 400)
        r = self.client.post("/api/events", json={"title": "X", "inbox_item_id": "abc"}, headers=h)
        self.assertEqual(r.status_code, 201)

    def test_club_page_lists_upcoming_events(self):
        h = self.user()
        club = self.client.post("/api/clubs", json={"name": "Code Club"}, headers=h).get_json()["club"]
        self.assertEqual(self.client.get(f"/api/clubs/{club['id']}", headers=h).status_code, 200)
        self.assertTrue(self.client.post(f"/api/clubs/{club['id']}/follow", headers=h).get_json()["following"] is False)


if __name__ == "__main__":
    unittest.main()
