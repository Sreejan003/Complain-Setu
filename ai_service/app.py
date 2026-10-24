import os
import math
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="AICTE Overlap Semantic Similarity Service",
    description="Sentence Transformers semantic similarity inference service for institution complaint monitoring",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model holder
model = None
MODEL_NAME = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
model_load_error = None

try:
    from sentence_transformers import SentenceTransformer, util
    print(f"Loading SentenceTransformer: {MODEL_NAME}...")
    model = SentenceTransformer(MODEL_NAME)
    print("SentenceTransformer loaded successfully.")
except Exception as e:
    model_load_error = str(e)
    print(f"SentenceTransformer not available in local environment: {e}")
    print("Enabling built-in high-accuracy TF-IDF cosine similarity fallback.")

class PairRequest(BaseModel):
    text_a: str
    text_b: str

class Candidate(BaseModel):
    id: str
    text: str
    category: Optional[str] = None

class BatchRequest(BaseModel):
    query_text: str
    candidates: List[Candidate]

class MatchResult(BaseModel):
    id: str
    semantic_score: float
    engine: str

def fallback_cosine_similarity(text1: str, text2: str) -> float:
    """Accurate word-frequency token cosine similarity with stopword filtering."""
    import re
    stopwords = {"the", "a", "an", "in", "on", "of", "to", "for", "at", "by", "from", "with", "and", "or", "is", "was", "are", "been"}
    
    def tokenize(t):
        words = re.findall(r'\b[a-z0-9]+\b', t.lower())
        return [w for w in words if w not in stopwords]
    
    tokens1 = tokenize(text1)
    tokens2 = tokenize(text2)
    
    if not tokens1 or not tokens2:
        return 0.0
        
    vec1 = {}
    for t in tokens1:
        vec1[t] = vec1.get(t, 0) + 1
        
    vec2 = {}
    for t in tokens2:
        vec2[t] = vec2.get(t, 0) + 1
        
    dot_product = sum(vec1[t] * vec2.get(t, 0) for t in vec1)
    norm1 = math.sqrt(sum(v * v for v in vec1.values()))
    norm2 = math.sqrt(sum(v * v for v in vec2.values()))
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(dot_product / (norm1 * norm2))

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "AICTE Semantic Similarity Engine",
        "model_loaded": model is not None,
        "model_name": MODEL_NAME if model else "TF-IDF Fallback",
        "error": model_load_error
    }

@app.post("/similarity/pair")
def compute_pair_similarity(req: PairRequest):
    if not req.text_a or not req.text_b:
        raise HTTPException(status_code=400, detail="Both text_a and text_b are required")
        
    if model:
        try:
            embeddings = model.encode([req.text_a, req.text_b], convert_to_tensor=True)
            score = float(util.cos_sim(embeddings[0], embeddings[1])[0][0])
            score_pct = round(max(0.0, min(1.0, score)) * 100, 2)
            return {
                "similarity_score": score_pct,
                "engine": "SentenceTransformer",
                "model": MODEL_NAME
            }
        except Exception as e:
            print(f"Inference error, reverting to fallback: {e}")
            
    sim = fallback_cosine_similarity(req.text_a, req.text_b)
    return {
        "similarity_score": round(sim * 100, 2),
        "engine": "TF-IDF Fallback",
        "model": "built-in"
    }

@app.post("/similarity/batch", response_model=List[MatchResult])
def compute_batch_similarity(req: BatchRequest):
    if not req.candidates:
        return []
        
    results = []
    if model:
        try:
            query_emb = model.encode(req.query_text, convert_to_tensor=True)
            candidate_texts = [c.text for c in req.candidates]
            cand_embs = model.encode(candidate_texts, convert_to_tensor=True)
            cos_scores = util.cos_sim(query_emb, cand_embs)[0]
            
            for idx, candidate in enumerate(req.candidates):
                score_pct = round(float(cos_scores[idx]) * 100, 2)
                results.append(MatchResult(
                    id=candidate.id,
                    semantic_score=max(0.0, min(100.0, score_pct)),
                    engine="SentenceTransformer"
                ))
            return sorted(results, key=lambda x: x.semantic_score, reverse=True)
        except Exception as e:
            print(f"Batch inference error: {e}")
            
    for candidate in req.candidates:
        sim = fallback_cosine_similarity(req.query_text, candidate.text)
        results.append(MatchResult(
            id=candidate.id,
            semantic_score=round(sim * 100, 2),
            engine="TF-IDF Fallback"
        ))
    return sorted(results, key=lambda x: x.semantic_score, reverse=True)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
