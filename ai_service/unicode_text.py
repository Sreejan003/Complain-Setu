"""Deterministic lexical processing; no cross-language semantic claim."""
import math
import unicodedata
from collections import Counter

PREPROCESSING_VERSION = "unicode-nfkc-lower-v1"
STOPWORDS = set("the a an and or but in on at to for of with by from up about into over after is are was were be been being have has had do does did this that these those it its we they our their student college institution complaint aicte".split())


def unicode_tokens(text: str) -> list[str]:
    normalized = unicodedata.normalize("NFKC", text).lower()
    tokens, current = [], []
    for character in normalized:
        if unicodedata.category(character)[0] in {"L", "M", "N"}:
            current.append(character)
        elif current:
            tokens.append("".join(current))
            current = []
    if current:
        tokens.append("".join(current))
    return [token for token in tokens if token not in STOPWORDS and any(unicodedata.category(character)[0] in {"L", "N"} for character in token)]


def lexical_cosine(left: str, right: str) -> float:
    a, b = Counter(unicode_tokens(left)), Counter(unicode_tokens(right))
    denominator = math.sqrt(sum(value * value for value in a.values())) * math.sqrt(sum(value * value for value in b.values()))
    return sum(value * b.get(token, 0) for token, value in a.items()) / denominator if denominator else 0.0
