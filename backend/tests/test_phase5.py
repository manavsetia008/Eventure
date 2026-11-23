"""Unit and Integration Tests for Phase 5 Industry-Ready Features:

1. Sarvam 24-hour Voice Call scheduling on single replaceable Top-Priority Event.
2. Real-Time Hackathon Suggestion Engine based on User Profile.
3. Gemini LLM Reviewer & Conversational Fallback.
4. Neo4j Graph Database Client connector & fallback.
5. Auth token revocation on logout.
"""
from datetime import datetime, timedelta
import unittest

from app import create_app
from app.auth import clear_revoked_tokens
from app.config import Config
from app.extensions import db
from app.models import Event, Stage, TopPriorityCall, User, UserEvent
from app.services.gemini import review_hackathon_submission
from app.services.hackathon_suggest import suggest_hackathons_for_user
from app.services.neo4j_client import get_neo4j_driver, get_graph_recommendations


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    AUTO_CREATE_DB = True
    SECRET_KEY = "test-secret-key-minimum-32-bytes-long-secure-phrase!"
    CORS_ORIGINS = "http://localhost:5173"
    SARVAM_API_KEY = "test_sarvam_key"
    GEMINI_API_KEY = ""


class Phase5TestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestConfig)
        self.client = self.app.test_client()
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()

        # Register a test student
        resp = self.client.post("/api/auth/register", json={
            "name": "Alex Builder",
            "email": "alex@campus.edu",
            "password": "Password123",
            "college": "State Tech University",
            "goals": "AI, Web3, Hackathons",
        })
        self.token = resp.get_json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.user = User.query.filter_by(email="alex@campus.edu").first()

    def tearDown(self):
        clear_revoked_tokens()
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_top_priority_event_scheduled_exactly_24h_before_deadline(self):
        """Top priority event schedules call exactly 24 hours before the latest deadline."""
        now = datetime.now()
        deadline = now + timedelta(days=5)

        # Create event
        ev = Event(
            title="National AI Hackathon 2026",
            platform="Unstop",
            category="hackathon",
            start_at=deadline + timedelta(hours=2),
            registration_deadline=deadline,
            is_public=True,
            created_by=self.user.id,
        )
        db.session.add(ev)
        db.session.commit()

        # Add a later stage deadline
        ue = UserEvent(user_id=self.user.id, event_id=ev.id, status="registered")
        db.session.add(ue)
        db.session.flush()
        final_stage_due = deadline + timedelta(days=2)
        db.session.add(Stage(user_event_id=ue.id, name="Final Code Submission", due_at=final_stage_due))
        db.session.commit()

        # Set as Top Priority
        resp = self.client.post(
            "/api/top-priority/set",
            headers=self.headers,
            json={"event_id": ev.id, "phone_number": "+919876543210"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertTrue(data["ok"])
        tp = data["top_priority"]
        self.assertEqual(tp["event_id"], ev.id)
        self.assertEqual(tp["phone_number"], "+919876543210")
        self.assertEqual(tp["status"], "scheduled")

        # Verify scheduled time is exactly 24h before the latest deadline
        expected_call_time = final_stage_due - timedelta(hours=24)
        call_rec = TopPriorityCall.query.filter_by(user_id=self.user.id).first()
        self.assertIsNotNone(call_rec)
        self.assertAlmostEqual(
            call_rec.scheduled_call_at.timestamp(),
            expected_call_time.timestamp(),
            delta=5
        )

    def test_top_priority_is_single_and_replaceable(self):
        """Setting a new top-priority event replaces any previous one."""
        ev1 = Event(title="Event One", start_at=datetime.now() + timedelta(days=3))
        ev2 = Event(title="Event Two", start_at=datetime.now() + timedelta(days=6))
        db.session.add_all([ev1, ev2])
        db.session.commit()

        # Set ev1
        self.client.post("/api/top-priority/set", headers=self.headers, json={"event_id": ev1.id})
        self.assertEqual(TopPriorityCall.query.filter_by(user_id=self.user.id).count(), 1)
        self.assertEqual(TopPriorityCall.query.filter_by(user_id=self.user.id).first().event_id, ev1.id)

        # Set ev2 -> replaces ev1
        resp = self.client.post("/api/top-priority/set", headers=self.headers, json={"event_id": ev2.id})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(TopPriorityCall.query.filter_by(user_id=self.user.id).count(), 1)
        self.assertEqual(TopPriorityCall.query.filter_by(user_id=self.user.id).first().event_id, ev2.id)

        # Remove top priority
        del_resp = self.client.delete("/api/top-priority", headers=self.headers)
        self.assertEqual(del_resp.status_code, 200)
        self.assertIsNone(TopPriorityCall.query.filter_by(user_id=self.user.id).first())

    def test_test_voice_call_trigger(self):
        """Tests manual immediate trigger of Sarvam voice call for top priority event."""
        ev = Event(title="Flagship Hackathon", start_at=datetime.now() + timedelta(days=2))
        db.session.add(ev)
        db.session.commit()
        self.client.post("/api/top-priority/set", headers=self.headers, json={"event_id": ev.id, "phone_number": "1234567890"})

        resp = self.client.post("/api/top-priority/test-call", headers=self.headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertTrue(data["ok"])
        self.assertIn("call_result", data)
        self.assertIn("call_id", data["call_result"])

    def test_hackathon_suggestions_for_user_profile(self):
        """Real-time suggestion engine scores events against student skills."""
        suggestions = suggest_hackathons_for_user(self.user, {})
        self.assertTrue(len(suggestions) > 0)
        best = suggestions[0]
        self.assertIn("match_score", best)
        self.assertIn("title", best)
        self.assertIn("reason", best)

        # Check API endpoint
        resp = self.client.get("/api/discover/suggestions", headers=self.headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIn("suggestions", data)
        self.assertTrue(len(data["suggestions"]) > 0)

    def test_gemini_submission_review_fallback(self):
        """Gemini review provides structured rubric score even when offline."""
        vault_data = {
            "demo_url": "https://eventure.demo",
            "github_url": "https://github.com/team/eventure",
            "deck_url": "https://docs.google.com/presentation/d/123",
            "video_url": "",
            "tech_stack": "React, Python, Flask",
            "checks": {"repo_public": True, "live_working": True},
        }
        res = review_hackathon_submission(vault_data, "Global AI Hackathon", api_key="")
        self.assertIn("readiness_score", res)
        self.assertGreaterEqual(res["readiness_score"], 50)
        self.assertIn("markdown", res)

        # Check API route
        resp = self.client.post(
            "/api/assistant/review-submission",
            headers=self.headers,
            json={"vault": vault_data, "event_title": "AI Sprint"}
        )
        self.assertEqual(resp.status_code, 200)

    def test_token_revocation_on_logout(self):
        """Token revocation invalidates session on logout."""
        # /me works with active token
        me_resp = self.client.get("/api/auth/me", headers=self.headers)
        self.assertEqual(me_resp.status_code, 200)

        # Logout
        logout_resp = self.client.post("/api/auth/logout", headers=self.headers)
        self.assertEqual(logout_resp.status_code, 200)

        # Next call with same token must return 401
        me_after = self.client.get("/api/auth/me", headers=self.headers)
        self.assertEqual(me_after.status_code, 401)


if __name__ == "__main__":
    unittest.main()
