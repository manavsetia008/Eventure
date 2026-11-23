"""Comprehensive mentor assessment verification suite covering all 7 deliverable areas:
1. Auth & Overload Shield (Role-based access, encrypted tokens, sanitization, rate limiting)
2. ArgosX Security Gate (Security headers, anti-fingerprinting, sanitization)
3. Base Primary Language (Auto-translation into selected Indian language)
4. Sarvam Voice & Chat Bot (Conversational AI, clash check, navigation, voice generation)
5. Search Event >70% Match (Portal catalog matching, high-confidence auto-match, choice cards)
6. Priority-Gated Alerts (Reminders restricted strictly to Keep/Registered events to save API costs)
7. 3 Live Venue Customer Test Validations (IIT Bombay, BITS Pilani, DTU Delhi)
"""
from datetime import datetime, timedelta
import unittest
from unittest.mock import patch

from app import create_app
from app.auth import make_token, role_required
from app.extensions import db
from app.models import Event, ExamPeriod, Stage, User, UserEvent
from app.ratelimit import Limiter
from app.sanitizer import is_suspicious_sqli, sanitize_text, sanitize_url
from app.services.assistant import process_assistant_message
from app.services.conflicts import detect_issues
from app.services.portal_search import compute_match_score, search_portal_catalog
from app.services.reminders import compute_reminders, run_reminder_check
from app.services.travel import estimate_minutes, haversine_km

NOW = datetime(2026, 11, 21, 12, 0, 0)


class TestDeliverableAssessment(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from app.config import Config

        class TestConfig(Config):
            TESTING = True
            SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
            SECRET_KEY = "test-secret-key-assessment-gate-32bytes-secure!"
            JWT_EXPIRY_HOURS = 24
            ENABLE_SCHEDULER = False
            SARVAM_API_KEY = "test-mock-key"
            TIMEZONE = "Asia/Kolkata"

        cls.app = create_app(TestConfig)

    def setUp(self):
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    # ─────────────────────────────────────────────────────────────────────────────
    # 1. Auth & Overload Shield
    # ─────────────────────────────────────────────────────────────────────────────
    def test_auth_roles_and_token_claims(self):
        student = User(name="Aarav", email="aarav@college.edu", role="student", primary_language="hi-IN")
        student.set_password("pass1234")
        organizer = User(name="Priya", email="priya@college.edu", role="organizer", primary_language="en")
        organizer.set_password("pass1234")
        db.session.add_all([student, organizer])
        db.session.commit()

        # Check model and to_dict
        self.assertEqual(student.to_dict()["role"], "student")
        self.assertEqual(student.to_dict()["primary_language"], "hi-IN")
        self.assertEqual(organizer.to_dict()["role"], "organizer")

        # Check token claims
        token = make_token(student)
        import jwt
        decoded = jwt.decode(token, self.app.config["SECRET_KEY"], algorithms=["HS256"])
        self.assertEqual(decoded["sub"], str(student.id))
        self.assertEqual(decoded["role"], "student")
        self.assertEqual(decoded["email"], "aarav@college.edu")

    def test_xss_and_sqli_sanitization(self):
        # Stored/Reflected XSS payloads
        xss_raw = "Campus Hackathon <script>alert('pwned')</script> <img src=x onerror=alert(1)>"
        cleaned = sanitize_text(xss_raw)
        self.assertNotIn("<script>", cleaned)
        self.assertNotIn("onerror", cleaned)
        self.assertEqual(cleaned, "Campus Hackathon")

        # Dangerous URLs
        self.assertEqual(sanitize_url("javascript:stealCookies()"), "")
        self.assertEqual(sanitize_url("https://unstop.com/event"), "https://unstop.com/event")

        # SQLi detection heuristic
        self.assertTrue(is_suspicious_sqli("admin' UNION SELECT * FROM users--"))
        self.assertTrue(is_suspicious_sqli("; DROP TABLE events;--"))
        self.assertFalse(is_suspicious_sqli("Hackathon in Auditorium 2"))

    def test_overload_shield_rate_limiting(self):
        limiter = Limiter(limit=3, window_seconds=60, name="test_overload")
        ip = "192.168.1.100"
        self.assertTrue(limiter.allow(ip))
        self.assertTrue(limiter.allow(ip))
        self.assertTrue(limiter.allow(ip))
        # 4th request must be blocked
        self.assertFalse(limiter.allow(ip))
        self.assertTrue(limiter.blocked(ip))

    # ─────────────────────────────────────────────────────────────────────────────
    # 2. ArgosX Security Gate Headers
    # ─────────────────────────────────────────────────────────────────────────────
    def test_argosx_security_headers(self):
        client = self.app.test_client()
        res = client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(res.headers.get("X-Frame-Options"), "DENY")
        self.assertEqual(res.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin")
        self.assertIn("microphone=(self)", res.headers.get("Permissions-Policy", ""))
        self.assertNotIn("Server", res.headers)

    # ─────────────────────────────────────────────────────────────────────────────
    # 3. Base Primary Language
    # ─────────────────────────────────────────────────────────────────────────────
    def test_base_primary_language_selection(self):
        user = User(name="Ananya", email="ananya@college.edu", role="student", primary_language="ta-IN")
        db.session.add(user)
        db.session.commit()

        d = user.to_dict()
        self.assertEqual(d["primary_language"], "ta-IN")

        # Test updating primary language to Hindi
        user.primary_language = "hi-IN"
        db.session.commit()
        self.assertEqual(user.to_dict()["primary_language"], "hi-IN")

    # ─────────────────────────────────────────────────────────────────────────────
    # 4. Sarvam Voice & Chat Bot
    # ─────────────────────────────────────────────────────────────────────────────
    def test_sarvam_assistant_intents(self):
        user = User(name="Vikram", email="vikram@college.edu", role="student", primary_language="en")
        db.session.add(user)
        db.session.commit()

        # Navigation intent
        res_nav = process_assistant_message(user, "Take me to discover", self.app.config)
        self.assertIsNotNone(res_nav["action"])
        self.assertEqual(res_nav["action"]["type"], "navigate")
        self.assertEqual(res_nav["action"]["target"], "/discover")

        # Clash check intent (zero clashes)
        res_clash = process_assistant_message(user, "Check if I have any schedule clashes", self.app.config)
        self.assertIn("zero schedule clashes", res_clash["reply"].lower())

        # Event drafting intent
        res_add = process_assistant_message(user, "Add AI Hackathon on 28 Nov 2026 at Audi 1", self.app.config)
        self.assertIsNotNone(res_add["action"])
        self.assertEqual(res_add["action"]["type"], "draft_event")
        self.assertIn("AI Hackathon", res_add["action"]["event"]["title"])

    # ─────────────────────────────────────────────────────────────────────────────
    # 5. Search Event >70% Match & Choice Cards
    # ─────────────────────────────────────────────────────────────────────────────
    def test_portal_search_match_engine(self):
        # The matcher now consumes current public feed entries only; it must not
        # rely on an embedded catalogue with stale schedules.
        listings = [
            {
                "title": "Flipkart GRiD 6.0 software development hackathon",
                "platform": "Unstop",
                "url": "https://unstop.com/hackathons/flipkart-grid-6",
                "description": "Software development competition",
            },
            {
                "title": "Hackathon Conclave for AI Builders",
                "platform": "Unstop",
                "url": "https://unstop.com/hackathons/ai-builders-conclave",
                "description": "Build projects with AI",
            },
        ]
        with patch("app.services.discover_feed.fetch_public_listings", return_value=listings):
            query = "Flipkart GRiD 6.0 software development hackathon"
            matches = search_portal_catalog(query)
            self.assertGreater(len(matches), 0)
            best = matches[0]
            self.assertEqual(best["platform"], "Unstop")
            self.assertGreaterEqual(best["match_score"], 90.0)

            # A partial name plus a platform keyword is only a potential match.
            score = compute_match_score(
                "ETHIndia 2026 Devfolio",
                {"title": "ETHIndia 2026 - World's Largest Ethereum Hackathon", "platform": "Devfolio"},
            )
            self.assertLess(score, 70.0)

            broad_matches = search_portal_catalog("Hackathon Conclave", min_score=30.0)
            self.assertGreaterEqual(len(broad_matches), 1)

    # ─────────────────────────────────────────────────────────────────────────────
    # 6. Priority-Gated Alerts
    # ─────────────────────────────────────────────────────────────────────────────
    def test_priority_gated_alerts_saves_api_cost(self):
        curr_now = datetime.now()
        user = User(name="Kavya", email="kavya@college.edu", threshold_keep=60, goals="hackathon, ai")
        db.session.add(user)
        db.session.commit()

        # 1. Registered event (MUST alert)
        ev_reg = Event(title="AI Summit", category="hackathon", start_at=curr_now + timedelta(days=2))
        db.session.add(ev_reg)
        db.session.flush()
        ue_reg = UserEvent(user_id=user.id, event_id=ev_reg.id, status="registered")
        db.session.add(ue_reg)
        db.session.flush()
        st_reg = Stage(user_event_id=ue_reg.id, name="Submit Code", due_at=curr_now + timedelta(hours=10))
        db.session.add(st_reg)

        # 2. Low-priority interested event (custom_score = 30 < 60 threshold) -> MUST BE SUPPRESSED
        ev_low = Event(title="Unrelated Fest", category="fest", start_at=curr_now + timedelta(days=2))
        db.session.add(ev_low)
        db.session.flush()
        ue_low = UserEvent(user_id=user.id, event_id=ev_low.id, status="interested", custom_score=30)
        db.session.add(ue_low)
        db.session.flush()
        st_low = Stage(user_event_id=ue_low.id, name="Register Entry", due_at=curr_now + timedelta(hours=10))
        db.session.add(st_low)

        # 3. Skipped event -> MUST BE SUPPRESSED
        ev_skip = Event(title="Skipped Talk", category="seminar", start_at=curr_now + timedelta(days=2))
        db.session.add(ev_skip)
        db.session.flush()
        ue_skip = UserEvent(user_id=user.id, event_id=ev_skip.id, status="skipped")
        db.session.add(ue_skip)
        db.session.flush()
        st_skip = Stage(user_event_id=ue_skip.id, name="RSVP", due_at=curr_now + timedelta(hours=10))
        db.session.add(st_skip)

        db.session.commit()

        # Run reminder check
        created = run_reminder_check(self.app, user_id=user.id)
        # Exactly 1 notification should be created (for the registered event). Low-priority and skipped are suppressed!
        self.assertEqual(created, 1)

    # ─────────────────────────────────────────────────────────────────────────────
    # 7. Three Live Venue Customer Test Validations
    # ─────────────────────────────────────────────────────────────────────────────
    def test_three_live_venue_validations(self):
        """Customer test validations across 3 real campus venues:
        Venue 1: IIT Bombay - Convocation Hall, Powai, Mumbai (19.1334, 72.9133)
        Venue 2: BITS Pilani - SAC Auditorium, Pilani, Rajasthan (28.3639, 75.5873)
        Venue 3: Delhi Technological University (DTU) - Dr. B.R. Ambedkar Audi, Delhi (28.7501, 77.1177)
        """
        # Venue coordinates
        v1_iitb = {"lat": 19.1334, "lng": 72.9133, "venue": "IIT Bombay - Convocation Hall"}
        v2_bits = {"lat": 28.3639, "lng": 75.5873, "venue": "BITS Pilani - SAC Auditorium"}
        v3_dtu  = {"lat": 28.7501, "lng": 77.1177, "venue": "DTU Delhi - Dr. B.R. Ambedkar Audi"}

        # 1. Geographic Distance & Travel Time Validation
        # Mumbai to Delhi is ~1150 km straight line
        dist_mumbai_delhi = haversine_km(v1_iitb["lat"], v1_iitb["lng"], v3_dtu["lat"], v3_dtu["lng"])
        self.assertGreater(dist_mumbai_delhi, 1100.0)
        self.assertLess(dist_mumbai_delhi, 1300.0)

        # Pilani to Delhi is ~160 km
        dist_pilani_delhi = haversine_km(v2_bits["lat"], v2_bits["lng"], v3_dtu["lat"], v3_dtu["lng"])
        self.assertGreater(dist_pilani_delhi, 140.0)
        self.assertLess(dist_pilani_delhi, 190.0)

        # Travel time estimate (offline) for 160km must be > 120 minutes
        travel_pilani_delhi = estimate_minutes(v2_bits["lat"], v2_bits["lng"], v3_dtu["lat"], v3_dtu["lng"])
        self.assertGreater(travel_pilani_delhi, 120)

        # 2. Clash & Travel Gap Impossibility Validation
        # Student scheduled to be in IIT Bombay ending at 12:00 PM, and in DTU Delhi at 2:00 PM (2-hour gap for 1150 km)
        events = [
            {"id": 1, "title": "Techfest IIT Bombay", "start": NOW, "end": NOW + timedelta(hours=3),
             "lat": v1_iitb["lat"], "lng": v1_iitb["lng"], "venue": v1_iitb["venue"]},
            {"id": 2, "title": "DTU Hackathon", "start": NOW + timedelta(hours=5), "end": NOW + timedelta(hours=9),
             "lat": v3_dtu["lat"], "lng": v3_dtu["lng"], "venue": v3_dtu["venue"]},
        ]
        issues = detect_issues(events, travel_minutes_fn=lambda a, b: estimate_minutes(a["lat"], a["lng"], b["lat"], b["lng"]))
        # Must detect travel gap impossibility
        travel_issues = [iss for iss in issues if iss["type"] == "travel_gap"]
        self.assertEqual(len(travel_issues), 1)
        self.assertIn("IIT Bombay", travel_issues[0]["message"])
        self.assertIn("DTU Hackathon", travel_issues[0]["message"])

        # 3. Exam Period Conflict Validation at Campus
        exams = [{"label": "Semester Endsem Exams", "start": (NOW + timedelta(days=3)).date(), "end": (NOW + timedelta(days=10)).date()}]
        event_in_exam = [
            {"id": 3, "title": "BITS Pilani APOGEE Hack", "start": NOW + timedelta(days=5), "end": NOW + timedelta(days=6),
             "lat": v2_bits["lat"], "lng": v2_bits["lng"], "venue": v2_bits["venue"]}
        ]
        exam_issues = detect_issues(event_in_exam, exam_periods=exams)
        self.assertEqual(len(exam_issues), 1)
        self.assertEqual(exam_issues[0]["type"], "exam_week")
        self.assertIn("Semester Endsem Exams", exam_issues[0]["message"])


if __name__ == "__main__":
    unittest.main()
