"""Synthetic smoke measurements only; not the held-out overlap evaluation."""
import argparse
import json
import os
import platform
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path
from providers import SimilarityProvider
from unicode_text import lexical_cosine

EXAMPLES = {
    "hi": "शिक्षकों को तीन महीने से वेतन नहीं मिला है।",
    "gu": "શિક્ષકોને ત્રણ મહિનાથી પગાર મળ્યો નથી.",
    "ta": "ஆசிரியர்களுக்கு மூன்று மாதங்களாக சம்பளம் வழங்கப்படவில்லை.",
    "te": "అధ్యాపకులకు మూడు నెలలుగా జీతాలు చెల్లించలేదు.",
    "bn": "শিক্ষকদের তিন মাসের বেতন দেওয়া হয়নি।",
    "kn": "ಶಿಕ್ಷಕರಿಗೆ ಮೂರು ತಿಂಗಳಿನಿಂದ ವೇತನ ಪಾವತಿಸಿಲ್ಲ.",
    "mixed": "Faculty salary तीन महीने से unpaid है।",
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    arguments = parser.parse_args()
    started = time.perf_counter()
    provider = SimilarityProvider()
    load_ms = (time.perf_counter() - started) * 1000
    if provider.mode != "multilingual_embeddings":
        raise RuntimeError("No embedding measurement claimed: the configured model is unavailable")
    query = "Teachers have not received their salaries for three months."
    unrelated = "The library plans to add new books and reading tables."
    rows = []
    for language, original in EXAMPLES.items():
        started = time.perf_counter()
        related = provider.pair(query, original)
        cold_ms = (time.perf_counter() - started) * 1000
        unrelated_score = provider.pair(unrelated, original)
        warm_times = []
        for _ in range(5):
            started = time.perf_counter()
            provider.pair(query, original)
            warm_times.append((time.perf_counter() - started) * 1000)
        if related["mode"] != "multilingual_embeddings" or unrelated_score["mode"] != "multilingual_embeddings":
            raise RuntimeError("Embedding measurement degraded; report mode separately instead of claiming embeddings")
        rows.append({"language": language, "sample_size": 1, "synthetic_text": original, "related_embedding_similarity": related["similarity_score"], "unrelated_embedding_similarity": unrelated_score["similarity_score"],
            "related_ranked_above_unrelated": related["similarity_score"] > unrelated_score["similarity_score"], "lexical_similarity": round(lexical_cosine(query, original) * 100, 2), "uncached_pair_ms": round(cold_ms, 2), "cached_pair_median_ms": round(statistics.median(warm_times), 2)})
    report = {"purpose": "Synthetic multilingual smoke test, not accuracy evaluation or threshold tuning", "family": "smoke-only-salary-not-in-tuning-or-heldout", "label_review_status": "unreviewed synthetic drafts; no native review or official translation approval claimed", "generated_at": datetime.now(timezone.utc).isoformat(),
        "python": platform.python_version(), "platform": platform.system(), "logical_cpus": os.cpu_count(), "threads": os.getenv("EMBEDDING_THREADS", "2"), "device": os.getenv("EMBEDDING_DEVICE", "cpu"), "provider": provider.metadata(), "model_load_ms": round(load_ms, 2), "embedding_dimensions": provider.model.get_embedding_dimension(), "rows": rows,
        "limitations": "One example per language; scores are not probabilities. Cached times exclude model inference. Cross-language and domain accuracy require the separate labeled family-split evaluation."}
    output = Path(arguments.output); output.parent.mkdir(parents=True, exist_ok=True); output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"model": provider.model_id, "revision": provider.revision, "mode": provider.mode, "samples": len(rows), "rank_checks_satisfied": sum(row["related_ranked_above_unrelated"] for row in rows), "report": str(output)}))


if __name__ == "__main__":
    main()
