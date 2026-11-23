import unittest
from unittest.mock import patch

from app.services.portal_search import compute_match_score, search_portal_catalog


class PortalSearchTests(unittest.TestCase):
    def test_exact_event_title_is_a_high_confidence_match(self):
        score = compute_match_score(
            "Campus AI Buildathon 2026",
            {"title": "Campus AI Buildathon 2026", "description": "AI event"},
        )
        self.assertEqual(score, 100.0)

    def test_generic_hackathon_keyword_cannot_be_high_confidence(self):
        score = compute_match_score(
            "hackathon",
            {"title": "Annual Campus Hackathon", "description": "A student event"},
        )
        self.assertLess(score, 70.0)

    def test_short_title_fragment_cannot_be_high_confidence(self):
        score = compute_match_score(
            "campus",
            {"title": "Campus AI Buildathon", "description": "Buildathon"},
        )
        self.assertLess(score, 70.0)

    @patch("app.services.discover_feed.fetch_public_listings")
    def test_search_uses_only_current_public_feed_items(self, fetch):
        fetch.return_value = [
            {
                "title": "Campus AI Buildathon 2026",
                "platform": "Unstop",
                "url": "https://unstop.com/hackathons/campus-ai-buildathon",
                "start_at": None,
            },
            {
                "title": "Lookalike Host",
                "platform": "Unknown",
                "url": "https://unstop.com.evil.example/hackathons/lookalike",
            },
        ]
        matches = search_portal_catalog("Campus AI Buildathon 2026")
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0]["url"], "https://unstop.com/hackathons/campus-ai-buildathon")
        self.assertEqual(matches[0]["source"], "public_feed")
        self.assertFalse(matches[0]["verified"])

    @patch("app.services.discover_feed.fetch_public_listings", return_value=[])
    def test_empty_live_feed_does_not_return_fabricated_events(self, _fetch):
        self.assertEqual(search_portal_catalog("ETHIndia 2026"), [])


if __name__ == "__main__":
    unittest.main()
