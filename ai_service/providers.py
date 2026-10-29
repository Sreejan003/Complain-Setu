"""Optional local embeddings. No complaint text is logged or sent to model hosts."""
import hashlib
import os
import threading
import unicodedata
from collections import OrderedDict
from unicode_text import PREPROCESSING_VERSION, lexical_cosine

MODELS = {
    "intfloat/multilingual-e5-small": {"revision": "614241f622f53c4eeff9890bdc4f31cfecc418b3", "prefix": "query: ", "license": "MIT", "max_tokens": 512},
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2": {"revision": "e8f8c211226b894fcb81acc59f3b34ba3efd5f42", "prefix": "", "license": "Apache-2.0", "max_tokens": 128},
    "BAAI/bge-m3": {"revision": "5617a9f61b028005a4858fdac845db406aefb181", "prefix": "", "license": "MIT", "max_tokens": 8192},
}


class SimilarityProvider:
    def __init__(self):
        self.provider = os.getenv("EMBEDDING_PROVIDER", "lexical")
        if self.provider not in {"lexical", "sentence_transformers", "disabled"}:
            raise ValueError("EMBEDDING_PROVIDER must be lexical, sentence_transformers or disabled")
        self.model_id = os.getenv("EMBEDDING_MODEL", "intfloat/multilingual-e5-small")
        self.spec = MODELS.get(self.model_id)
        self.revision = os.getenv("EMBEDDING_REVISION") or (self.spec or {}).get("revision", "unconfigured")
        if self.provider == "sentence_transformers" and (not self.spec or len(self.revision) != 40 or any(character not in "0123456789abcdef" for character in self.revision)):
            raise ValueError("Select an allowlisted model and pinned hexadecimal revision")
        self.max_tokens = min((self.spec or {}).get("max_tokens", 512), max(32, int(os.getenv("EMBEDDING_MAX_TOKENS", "512"))))
        self.cache_limit = min(1024, max(0, int(os.getenv("EMBEDDING_CACHE_SIZE", "256"))))
        self.cache = OrderedDict()
        self.lock = threading.BoundedSemaphore(1)
        self.model = None
        self.error_code = None
        if self.provider == "sentence_transformers":
            try:
                import torch
                from sentence_transformers import SentenceTransformer
                torch.set_num_threads(max(1, min(8, int(os.getenv("EMBEDDING_THREADS", "2")))))
                self.model = SentenceTransformer(self.model_id, revision=self.revision, device=os.getenv("EMBEDDING_DEVICE", "cpu"),
                    cache_folder=os.getenv("EMBEDDING_CACHE_DIR"), trust_remote_code=False, token=False,
                    local_files_only=os.getenv("ALLOW_MODEL_DOWNLOAD", "false").lower() != "true")
                self.model.max_seq_length = self.max_tokens
            except Exception:
                self.error_code = "MODEL_UNAVAILABLE"

    @property
    def mode(self):
        if self.provider == "disabled":
            return "unavailable"
        return "multilingual_embeddings" if self.model is not None else "lexical_fallback"

    def metadata(self, mode=None):
        mode = mode or self.mode
        return {"mode": mode, "engine": "Multilingual embeddings" if mode == "multilingual_embeddings" else "Unicode lexical fallback" if mode == "lexical_fallback" else "Unavailable",
            "model": self.model_id if mode == "multilingual_embeddings" else "token-frequency-cosine" if mode == "lexical_fallback" else "none",
            "revision": self.revision if mode == "multilingual_embeddings" else "1", "preprocessing_version": PREPROCESSING_VERSION,
            "chunking_version": "token-window-mean-v1", "max_tokens": self.max_tokens,
            "limitation": "Similarity is not a calibrated probability of duplication." if mode == "multilingual_embeddings" else "Lexical overlap does not provide semantic cross-language understanding."}

    def cache_key(self, text):
        namespace = f"{self.model_id}:{self.revision}:{PREPROCESSING_VERSION}:token-window-mean-v1:{self.max_tokens}:{self.spec['prefix']}"
        return hashlib.sha256((namespace + "\0" + text).encode("utf-8")).hexdigest()

    def embedding(self, text):
        import numpy as np
        key = self.cache_key(text)
        if key in self.cache:
            self.cache.move_to_end(key)
            return self.cache[key]
        tokenizer = self.model.tokenizer
        prefix = self.spec["prefix"]
        prefix_ids = tokenizer.encode(prefix, add_special_tokens=False)
        ids = tokenizer.encode(unicodedata.normalize("NFKC", text).lower(), add_special_tokens=False, truncation=False)
        window = max(8, self.max_tokens - len(prefix_ids) - tokenizer.num_special_tokens_to_add(pair=False))
        chunks = [prefix + tokenizer.decode(ids[index:index + window], skip_special_tokens=True) for index in range(0, len(ids), window)] or [prefix]
        if len(chunks) > 64:
            raise ValueError("Input exceeds the bounded embedding window budget")
        vectors = self.model.encode(chunks, batch_size=8, normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False)
        vector = np.mean(vectors, axis=0)
        norm = np.linalg.norm(vector)
        vector = vector / norm if norm else vector
        if self.cache_limit:
            self.cache[key] = vector
            while len(self.cache) > self.cache_limit:
                self.cache.popitem(last=False)
        return vector

    def pair(self, left, right):
        if self.mode == "unavailable":
            return {**self.metadata(), "similarity_score": None}
        if self.model is not None and self.lock.acquire(blocking=False):
            try:
                score = float(self.embedding(left) @ self.embedding(right))
                return {**self.metadata(), "similarity_score": round(max(0.0, min(1.0, score)) * 100, 2)}
            except Exception:
                self.error_code = "INFERENCE_UNAVAILABLE"
            finally:
                self.lock.release()
        return {**self.metadata("lexical_fallback"), "similarity_score": round(lexical_cosine(left, right) * 100, 2)}
