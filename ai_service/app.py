import os
import secrets
from typing import Optional
from fastapi import FastAPI, Header, HTTPException, Depends
from pydantic import BaseModel, Field
from providers import SimilarityProvider
from unicode_text import lexical_cosine

app = FastAPI(title="Complain-Setu text similarity service", version="2.0.0", description="Optional local multilingual embeddings with an explicitly labeled Unicode lexical fallback.")
provider = SimilarityProvider()


def authorized(authorization: Optional[str] = Header(default=None)):
    expected = os.getenv("AI_SERVICE_TOKEN")
    if expected and not secrets.compare_digest(authorization or "", "Bearer " + expected):
        raise HTTPException(status_code=401, detail="Service authentication required")


class PairRequest(BaseModel):
    text_a: str = Field(min_length=1, max_length=20000)
    text_b: str = Field(min_length=1, max_length=20000)


class Candidate(BaseModel):
    id: str = Field(min_length=1, max_length=160)
    text: str = Field(min_length=1, max_length=20000)
    category: Optional[str] = None


class BatchRequest(BaseModel):
    query_text: str = Field(min_length=1, max_length=20000)
    candidates: list[Candidate] = Field(max_length=100)


@app.get("/health")
def health():
    return {"status": "unavailable" if provider.mode == "unavailable" else "ready", "service": "Complain-Setu text similarity", **provider.metadata(),
        "model_loaded": provider.model is not None, "configured_model": provider.model_id, "configured_revision": provider.revision, "error_code": provider.error_code,
        "cache_entries": len(provider.cache), "provider": provider.provider}


@app.post("/similarity/pair", dependencies=[Depends(authorized)])
def compute_pair_similarity(req: PairRequest):
    result = provider.pair(req.text_a, req.text_b)
    if result["mode"] == "unavailable":
        raise HTTPException(status_code=503, detail="Text similarity unavailable")
    return result


@app.post("/similarity/batch", dependencies=[Depends(authorized)])
def compute_batch_similarity(req: BatchRequest):
    if sum(len(candidate.text) for candidate in req.candidates) > 200000:
        raise HTTPException(status_code=413, detail="Candidate batch exceeds its text limit")
    results = []
    for candidate in req.candidates:
        result = provider.pair(req.query_text, candidate.text)
        if result["mode"] == "unavailable":
            raise HTTPException(status_code=503, detail="Text similarity unavailable")
        results.append({"id": candidate.id, "semantic_score": result["similarity_score"], **{key: value for key, value in result.items() if key != "similarity_score"}})
    return sorted(results, key=lambda item: item["semantic_score"], reverse=True)


fallback_cosine_similarity = lexical_cosine

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=os.getenv("AI_BIND_HOST", "127.0.0.1"), port=int(os.getenv("AI_PORT", "8000")), reload=False, access_log=False)
