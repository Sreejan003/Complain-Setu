import os
import unittest
from unittest.mock import patch

os.environ["EMBEDDING_PROVIDER"] = "lexical"
from fastapi.testclient import TestClient
from app import app
from providers import SimilarityProvider
from unicode_text import unicode_tokens, lexical_cosine, PREPROCESSING_VERSION


class TextServiceTests(unittest.TestCase):
    def test_indian_scripts_and_marks_survive(self):
        for text in ["शिक्षकों का वेतन नहीं मिला", "શિક્ષકોનો પગાર મળ્યો નથી", "ஆசிரியர்களுக்கு சம்பளம் வழங்கப்படவில்லை", "అధ్యాపకులకు జీతాలు చెల్లించలేదు", "শিক্ষকদের বেতন দেওয়া হয়নি", "ಶಿಕ್ಷಕರಿಗೆ ವೇತನ ಪಾವತಿಸಿಲ್ಲ"]:
            self.assertGreaterEqual(len(unicode_tokens(text)), 2)
            self.assertAlmostEqual(lexical_cosine(text, text), 1)
        self.assertIn("१२३", unicode_tokens("कक्षा १२३"))
        self.assertEqual(lexical_cosine("वेतन नहीं मिला", "சம்பளம் வழங்கப்படவில்லை"), 0)

    def test_http_contract_and_limits(self):
        with TestClient(app) as client:
            self.assertEqual(client.get("/health").json()["mode"], "lexical_fallback")
            result = client.post("/similarity/pair", json={"text_a": "தமிழ் சம்பளம்", "text_b": "தமிழ் சம்பளம்"})
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()["similarity_score"], 100)
            self.assertEqual(result.json()["preprocessing_version"], PREPROCESSING_VERSION)
            self.assertEqual(result.json()["mode"], "lexical_fallback")
            self.assertEqual(client.post("/similarity/pair", json={"text_a": "x" * 20001, "text_b": "x"}).status_code, 422)
            self.assertEqual(client.post("/similarity/batch", json={"query_text": "x", "candidates": [{"id": str(index), "text": "x"} for index in range(101)]}).status_code, 422)

    def test_service_secret_and_unavailable(self):
        with patch.dict(os.environ, {"AI_SERVICE_TOKEN": "synthetic-service-only"}), TestClient(app) as client:
            self.assertEqual(client.post("/similarity/pair", json={"text_a": "x", "text_b": "x"}).status_code, 401)
            self.assertEqual(client.post("/similarity/pair", json={"text_a": "x", "text_b": "x"}, headers={"Authorization": "Bearer synthetic-service-only"}).status_code, 200)
        with patch.dict(os.environ, {"EMBEDDING_PROVIDER": "disabled"}):
            self.assertEqual(SimilarityProvider().pair("x", "x")["mode"], "unavailable")

    def test_model_revision_and_window_changes_invalidate_cache_keys(self):
        provider = SimilarityProvider()
        original = provider.cache_key("Synthetic text")
        provider.revision = "a" * 40
        self.assertNotEqual(provider.cache_key("Synthetic text"), original)
        revised = provider.cache_key("Synthetic text")
        provider.max_tokens = 64
        self.assertNotEqual(provider.cache_key("Synthetic text"), revised)


if __name__ == "__main__":
    unittest.main()
