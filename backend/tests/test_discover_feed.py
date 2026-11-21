import unittest
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import patch

from app.services.hackathon_suggest import suggest_hackathons_for_user
from app.services.discover_feed import (
    _AnchorParser,
    _devfolio_card_context,
    _normalise_unstop,
)


class PublicDiscoverFeedTests(unittest.TestCase):
    def test_unstop_listing_is_normalised_without_inventing_dates(self):
        item = {
            "title": "Campus AI Hackathon",
            "url": "/hackathons/campus-ai-hackathon-123",
            "mode": "online",
            "latitude": 28.6139,
            "longitude": 77.2090,
            "start_date": "2026-12-10T10:00:00",
            "registration_end_date": "2026-12-05T23:59:00",
        }
        result = _normalise_unstop(item)
        self.assertEqual(result["title"], "Campus AI Hackathon")
        self.assertEqual(result["platform"], "Unstop")
        self.assertEqual(result["venue_name"], "Online")
        self.assertEqual(result["lat"], 28.6139)
        self.assertEqual(result["lng"], 77.2090)
        self.assertEqual(result["url"], "https://unstop.com/hackathons/campus-ai-hackathon-123")
        self.assertEqual(result["start_at"].isoformat(), "2026-12-10T10:00:00")
        self.assertEqual(result["registration_deadline"].isoformat(), "2026-12-05T23:59:00")
        self.assertIsNone(result["end_at"])

    def test_devfolio_parser_extracts_public_microsite_link(self):
        page = (
            '<section><a href="https://buildathon.devfolio.co">Buildathon 2026</a>'
            '<span>Online Open Starts 23/11/26 Apply now</span></section>'
        )
        parser = _AnchorParser()
        parser.feed(page)
        self.assertEqual(len(parser.anchors), 1)
        self.assertEqual(parser.anchors[0]["text"], "Buildathon 2026")
        start = page.find("https://buildathon.devfolio.co")
        status, date, venue = _devfolio_card_context(
            page, start, start + len("https://buildathon.devfolio.co")
        )
        self.assertEqual(status, "open")
        self.assertEqual(date.strftime("%Y-%m-%d"), "2026-11-23")
        self.assertEqual(venue, "Online")

    def test_devfolio_ended_listing_is_identified(self):
        page = (
            '<a href="https://past-hack.devfolio.co">Past Hack</a>'
            '<span>Offline Ended See projects</span>'
        )
        start = page.find("https://past-hack.devfolio.co")
        status, date, venue = _devfolio_card_context(
            page, start, start + len("https://past-hack.devfolio.co")
        )
        self.assertEqual(status, "ended")
        self.assertIsNone(date)
        self.assertEqual(venue, "Offline venue to be confirmed")

    def test_suggestion_ranking_accepts_published_datetimes_and_missing_dates(self):
        user = SimpleNamespace(goals_list=["AI", "Python"], college="Delhi")
        listings = [
            {
                "title": "AI Buildathon",
                "platform": "Devfolio",
                "url": "https://ai-buildathon.devfolio.co",
                "start_at": datetime(2026, 12, 10, 10, 0),
                "description": "Build with AI and Python",
            },
            {
                "title": "Python Weekend Hack",
                "platform": "Unstop",
                "url": "https://unstop.com/hackathons/python-weekend",
                "start_at": None,
                "description": "Python coding competition",
            },
        ]
        with patch("app.services.discover_feed.fetch_public_listings", return_value=listings):
            suggestions = suggest_hackathons_for_user(user, {})
        self.assertEqual(len(suggestions), 2)
        self.assertIsInstance(suggestions[0]["start_at"], datetime)
        self.assertIsNone(suggestions[1]["start_at"])

    def test_portal_directory_fallback_is_available_when_live_sources_are_empty(self):
        user = SimpleNamespace(goals_list=["AI", "software"], college="Delhi")
        with patch("app.services.discover_feed.fetch_public_listings", return_value=[]):
            suggestions = suggest_hackathons_for_user(user, {})
        self.assertGreater(len(suggestions), 0)
        self.assertEqual(suggestions[0]["source"], "portal_directory")
        self.assertIsNone(suggestions[0]["start_at"])
        self.assertIsNone(suggestions[0]["registration_deadline"])
        self.assertIn("portal", suggestions[0]["reason"].lower())


if __name__ == "__main__":
    unittest.main()
