import json
import unittest
from unittest.mock import patch

from app.languages import LANGUAGES, SUPPORTED_LANGUAGE_CODES
from app.services.sarvam_ai import translate_many_with_sarvam
from app.services.gemini import translate_many_with_gemini


class LanguageCatalogueTests(unittest.TestCase):
    def test_catalogue_contains_english_and_twenty_two_indic_languages(self):
        self.assertEqual(len(SUPPORTED_LANGUAGE_CODES), 23)
        self.assertIn("en", SUPPORTED_LANGUAGE_CODES)
        self.assertIn("hi-IN", SUPPORTED_LANGUAGE_CODES)
        self.assertIn("ur-IN", SUPPORTED_LANGUAGE_CODES)
        self.assertEqual(LANGUAGES["ta-IN"]["name"], "Tamil")


class SarvamBatchTranslationTests(unittest.TestCase):
    @patch("app.services.sarvam_ai.translate_with_sarvam")
    def test_preserves_order_and_splits_translated_strings(self, translate):
        def fake_translate(combined, target, api_key, **kwargs):
            self.assertEqual(target, "hi-IN")
            return combined.replace("Hello", "नमस्ते").replace("Save changes", "बदलाव सहेजें")

        translate.side_effect = fake_translate
        result = translate_many_with_sarvam(
            ["Hello", "Save changes"], "hi-IN", "test-key"
        )
        self.assertEqual(result, ["नमस्ते", "बदलाव सहेजें"])
        translate.assert_called_once()

    @patch("app.services.sarvam_ai.translate_with_sarvam")
    def test_splits_large_lists_into_multiple_api_requests(self, translate):
        translate.side_effect = lambda text, *_args, **_kwargs: text
        values = [f"Label number {index}" for index in range(25)]
        result = translate_many_with_sarvam(values, "bn-IN", "test-key")
        self.assertEqual(len(result), len(values))
        self.assertGreaterEqual(translate.call_count, 3)


class GeminiBatchTranslationTests(unittest.TestCase):
    @patch("app.services.gemini.generate_with_gemini")
    def test_accepts_json_array_translation(self, generate):
        generate.return_value = json.dumps(["नमस्ते", "सहेजें"], ensure_ascii=False)
        result = translate_many_with_gemini(["Hello", "Save"], "Hindi", "test-key")
        self.assertEqual(result, ["नमस्ते", "सहेजें"])
        self.assertIn("native script", generate.call_args.kwargs["system_instruction"])

    @patch("app.services.gemini.generate_with_gemini")
    def test_safe_fallback_when_model_returns_invalid_json(self, generate):
        generate.return_value = "I cannot translate right now."
        values = ["Hello", "Save"]
        self.assertEqual(translate_many_with_gemini(values, "Hindi", "test-key"), values)


    @patch("app.services.sarvam_ai.requests.post")
    def test_sarvam_strict_mode_raises_instead_of_returning_english(self, post):
        post.side_effect = OSError("provider offline")
        from app.services.sarvam_ai import translate_with_sarvam
        with self.assertRaises(RuntimeError):
            translate_with_sarvam("Hello", "hi-IN", "test-key", strict=True)

    def test_sarvam_strict_mode_rejects_missing_key(self):
        from app.services.sarvam_ai import translate_with_sarvam
        with self.assertRaises(ValueError):
            translate_with_sarvam("Hello", "hi-IN", "", strict=True)

    @patch("app.services.gemini.generate_with_gemini", return_value="")
    def test_gemini_strict_mode_rejects_empty_translation(self, _generate):
        with self.assertRaises(RuntimeError):
            translate_many_with_gemini(["Hello"], "Hindi", "test-key", strict=True)



if __name__ == "__main__":
    unittest.main()
