"""
Vector Search Service — Supercharg'd
═══════════════════════════════════════════════════════════════════
Semantic search using TF-IDF embeddings stored in MongoDB.
Powers:
  • Sales knowledge base retrieval (objection patterns, closing techniques)
  • Semantic translation caching (find similar past translations)
  • Tower Talk context enrichment (retrieve winning responses for similar situations)

Approach: TF-IDF vectorization (local, zero external API dependency, sub-millisecond)
Storage: MongoDB collection with precomputed term vectors + cosine similarity
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import math
import re
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger("vector_search")

# ═══════════════════════════════════════════════════════════════════
# LOCAL TF-IDF VECTORIZATION
# ═══════════════════════════════════════════════════════════════════

# Automotive domain stop words (added on top of standard)
_STOP_WORDS = frozenset({
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about', 'but',
    'not', 'or', 'and', 'if', 'that', 'this', 'it', 'its', 'they',
    'them', 'their', 'we', 'our', 'you', 'your', 'he', 'she', 'his',
    'her', 'my', 'me', 'i', 'so', 'up', 'out', 'just', 'also', 'than',
    'then', 'too', 'very', 'more', 'no', 'yes', 'all', 'any', 'each',
})

# Automotive synonyms for better matching
_SYNONYMS = {
    'car': 'vehicle', 'auto': 'vehicle', 'automobile': 'vehicle',
    'truck': 'vehicle', 'suv': 'vehicle',
    'buy': 'purchase', 'buying': 'purchase',
    'cost': 'price', 'pricing': 'price', 'expensive': 'price',
    'cheap': 'price', 'affordable': 'price', 'budget': 'price',
    'payment': 'financing', 'loan': 'financing', 'credit': 'financing',
    'monthly': 'financing', 'apr': 'financing', 'rate': 'financing',
    'trade': 'trade_in', 'tradein': 'trade_in',
    'appraisal': 'trade_in', 'equity': 'trade_in',
    'drive': 'test_drive', 'ride': 'test_drive',
    'objection': 'concern', 'hesitation': 'concern', 'worry': 'concern',
    'appointment': 'visit', 'come_in': 'visit', 'swing_by': 'visit',
    'close': 'deal', 'closing': 'deal', 'paperwork': 'deal',
    'negotiate': 'deal', 'negotiation': 'deal',
}


def _tokenize(text: str) -> List[str]:
    """Tokenize, normalize, and apply synonym mapping."""
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s_-]', ' ', text)
    tokens = text.split()
    result = []
    for t in tokens:
        if t in _STOP_WORDS or len(t) < 2:
            continue
        # Apply synonym mapping
        mapped = _SYNONYMS.get(t, t)
        result.append(mapped)
    return result


def _term_freq(tokens: List[str]) -> Dict[str, float]:
    """Compute normalized term frequency vector."""
    counts = Counter(tokens)
    total = sum(counts.values())
    if total == 0:
        return {}
    return {term: count / total for term, count in counts.items()}


def _cosine_similarity_sparse(a: Dict[str, float], b: Dict[str, float]) -> float:
    """Cosine similarity between two sparse TF vectors."""
    if not a or not b:
        return 0.0

    # Dot product
    common_keys = set(a.keys()) & set(b.keys())
    if not common_keys:
        return 0.0

    dot = sum(a[k] * b[k] for k in common_keys)
    norm_a = math.sqrt(sum(v * v for v in a.values()))
    norm_b = math.sqrt(sum(v * v for v in b.values()))

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return dot / (norm_a * norm_b)


# ═══════════════════════════════════════════════════════════════════
# VECTOR SEARCH SERVICE
# ═══════════════════════════════════════════════════════════════════

class VectorSearchService:
    """
    Semantic search over MongoDB-stored TF-IDF vectors.

    Collections:
      • knowledge_embeddings  — sales playbook entries
      • translation_embeddings — cached translation pairs
      • response_embeddings   — winning Tower Talk responses
    """

    KNOWLEDGE_COLLECTION = "knowledge_embeddings"
    TRANSLATION_COLLECTION = "translation_embeddings"
    RESPONSE_COLLECTION = "response_embeddings"

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        # IDF cache (rebuilt periodically)
        self._idf: Dict[str, float] = {}
        self._doc_count = 0

    # ── Index Management ──────────────────────────────────────────

    async def ensure_indexes(self):
        """Create indexes for efficient querying."""
        for coll_name in [self.KNOWLEDGE_COLLECTION, self.TRANSLATION_COLLECTION, self.RESPONSE_COLLECTION]:
            coll = self.db[coll_name]
            await coll.create_index("category")
            await coll.create_index("created_at")
            await coll.create_index("content_hash", unique=True, sparse=True)
        logger.info("Vector search indexes ensured")

    async def _rebuild_idf(self):
        """Rebuild IDF weights from all documents."""
        doc_freq = defaultdict(int)
        total_docs = 0

        for coll_name in [self.KNOWLEDGE_COLLECTION, self.RESPONSE_COLLECTION]:
            cursor = self.db[coll_name].find({}, {"tf_vector": 1})
            async for doc in cursor:
                tf = doc.get("tf_vector", {})
                if tf:
                    total_docs += 1
                    for term in tf:
                        doc_freq[term] += 1

        if total_docs > 0:
            self._idf = {
                term: math.log(total_docs / (1 + freq))
                for term, freq in doc_freq.items()
            }
            self._doc_count = total_docs
        logger.info(f"IDF rebuilt: {len(self._idf)} terms, {total_docs} docs")

    def _tfidf_vector(self, tf: Dict[str, float]) -> Dict[str, float]:
        """Apply IDF weighting to a TF vector."""
        if not self._idf:
            return tf  # Fallback to raw TF if IDF not built yet
        return {term: freq * self._idf.get(term, 1.0) for term, freq in tf.items()}

    # ── Knowledge Base Operations ─────────────────────────────────

    async def add_knowledge(self, text: str, category: str, metadata: Optional[Dict] = None) -> str:
        """Add a knowledge entry with its TF vector."""
        content_hash = hashlib.sha256(text.encode()).hexdigest()

        # Check for duplicate
        existing = await self.db[self.KNOWLEDGE_COLLECTION].find_one({"content_hash": content_hash})
        if existing:
            return str(existing.get("entry_id", ""))

        tokens = _tokenize(text)
        tf = _term_freq(tokens)
        entry_id = str(uuid.uuid4())

        doc = {
            "entry_id": entry_id,
            "text": text,
            "category": category,
            "tf_vector": tf,
            "tokens": tokens[:100],  # Store first 100 tokens for debugging
            "content_hash": content_hash,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc),
            "usage_count": 0,
        }
        await self.db[self.KNOWLEDGE_COLLECTION].insert_one(doc)
        logger.info(f"Knowledge added: {category} — {text[:60]}...")
        return entry_id

    async def search_knowledge(self, query: str, category: Optional[str] = None, top_k: int = 5, min_score: float = 0.15) -> List[Dict]:
        """Semantic search across knowledge base."""
        query_tokens = _tokenize(query)
        query_tf = _term_freq(query_tokens)
        query_tfidf = self._tfidf_vector(query_tf)

        filt = {}
        if category:
            filt["category"] = category

        cursor = self.db[self.KNOWLEDGE_COLLECTION].find(filt, {"_id": 0})
        docs = await cursor.to_list(length=2000)

        scored = []
        for doc in docs:
            tf = doc.get("tf_vector", {})
            if not tf:
                continue
            doc_tfidf = self._tfidf_vector(tf)
            score = _cosine_similarity_sparse(query_tfidf, doc_tfidf)
            if score >= min_score:
                result = {
                    "entry_id": doc.get("entry_id", ""),
                    "text": doc.get("text", ""),
                    "category": doc.get("category", ""),
                    "score": round(score, 4),
                    "usage_count": doc.get("usage_count", 0),
                }
                scored.append(result)

        scored.sort(key=lambda x: x["score"], reverse=True)
        results = scored[:top_k]

        # Increment usage counters (fire-and-forget)
        for r in results:
            async def _inc(eid=r["entry_id"]):
                await self.db[self.KNOWLEDGE_COLLECTION].update_one(
                    {"entry_id": eid}, {"$inc": {"usage_count": 1}}
                )
            asyncio.create_task(_inc())

        return results

    # ── Response Memory (Winning Tower Talk Responses) ────────────

    async def store_response(self, situation: str, response: str, inquiry_type: str, rating: float = 1.0) -> str:
        """Store a Tower Talk response for future semantic retrieval."""
        combined_text = f"{inquiry_type} {situation} {response}"
        content_hash = hashlib.sha256(combined_text.encode()).hexdigest()

        existing = await self.db[self.RESPONSE_COLLECTION].find_one({"content_hash": content_hash})
        if existing:
            return str(existing.get("entry_id", ""))

        tokens = _tokenize(combined_text)
        tf = _term_freq(tokens)
        entry_id = str(uuid.uuid4())

        doc = {
            "entry_id": entry_id,
            "situation": situation,
            "response": response,
            "inquiry_type": inquiry_type,
            "tf_vector": tf,
            "content_hash": content_hash,
            "rating": rating,
            "created_at": datetime.now(timezone.utc),
            "usage_count": 0,
        }
        await self.db[self.RESPONSE_COLLECTION].insert_one(doc)
        return entry_id

    async def find_similar_responses(self, situation: str, inquiry_type: Optional[str] = None, top_k: int = 3, min_score: float = 0.20) -> List[Dict]:
        """Find winning responses for similar situations."""
        query_tokens = _tokenize(situation)
        query_tf = _term_freq(query_tokens)
        query_tfidf = self._tfidf_vector(query_tf)

        filt = {}
        if inquiry_type:
            filt["inquiry_type"] = inquiry_type

        cursor = self.db[self.RESPONSE_COLLECTION].find(filt, {"_id": 0})
        docs = await cursor.to_list(length=1000)

        scored = []
        for doc in docs:
            tf = doc.get("tf_vector", {})
            if not tf:
                continue
            doc_tfidf = self._tfidf_vector(tf)
            score = _cosine_similarity_sparse(query_tfidf, doc_tfidf)
            if score >= min_score:
                entry = {
                    "entry_id": doc.get("entry_id", ""),
                    "situation": doc.get("situation", ""),
                    "response": doc.get("response", ""),
                    "inquiry_type": doc.get("inquiry_type", ""),
                    "score": round(score, 4),
                    "rating": doc.get("rating", 1.0),
                }
                scored.append(entry)

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]

    # ── Semantic Translation Cache ────────────────────────────────

    async def cache_translation(self, source_text: str, translated_text: str, source_lang: str, target_lang: str):
        """Cache a translation with its TF vector for semantic lookup."""
        content_hash = hashlib.sha256(f"{source_lang}:{target_lang}:{source_text}".encode()).hexdigest()

        existing = await self.db[self.TRANSLATION_COLLECTION].find_one({"content_hash": content_hash})
        if existing:
            return

        tokens = _tokenize(source_text)
        tf = _term_freq(tokens)

        doc = {
            "entry_id": str(uuid.uuid4()),
            "source_text": source_text,
            "translated_text": translated_text,
            "source_lang": source_lang,
            "target_lang": target_lang,
            "tf_vector": tf,
            "content_hash": content_hash,
            "created_at": datetime.now(timezone.utc),
            "hit_count": 0,
        }
        await self.db[self.TRANSLATION_COLLECTION].insert_one(doc)

    async def find_cached_translation(self, text: str, source_lang: str, target_lang: str, min_score: float = 0.85) -> Optional[str]:
        """Find a semantically similar cached translation."""
        query_tokens = _tokenize(text)
        query_tf = _term_freq(query_tokens)
        query_tfidf = self._tfidf_vector(query_tf)

        filt = {"source_lang": source_lang, "target_lang": target_lang}
        cursor = self.db[self.TRANSLATION_COLLECTION].find(filt, {"_id": 0})
        docs = await cursor.to_list(length=500)

        best_score = 0.0
        best_translation = None
        best_entry_id = None

        for doc in docs:
            tf = doc.get("tf_vector", {})
            if not tf:
                continue
            doc_tfidf = self._tfidf_vector(tf)
            score = _cosine_similarity_sparse(query_tfidf, doc_tfidf)
            if score > best_score and score >= min_score:
                best_score = score
                best_translation = doc["translated_text"]
                best_entry_id = doc.get("entry_id")

        if best_translation and best_entry_id:
            async def _inc_hit(eid=best_entry_id):
                await self.db[self.TRANSLATION_COLLECTION].update_one(
                    {"entry_id": eid}, {"$inc": {"hit_count": 1}}
                )
            asyncio.create_task(_inc_hit())
            logger.info(f"Semantic translation cache hit (score={best_score:.3f})")

        return best_translation

    # ── Stats ─────────────────────────────────────────────────────

    async def stats(self) -> Dict[str, Any]:
        """Get vector search statistics."""
        knowledge_count = await self.db[self.KNOWLEDGE_COLLECTION].count_documents({})
        translation_count = await self.db[self.TRANSLATION_COLLECTION].count_documents({})
        response_count = await self.db[self.RESPONSE_COLLECTION].count_documents({})

        pipeline = [
            {"$group": {"_id": "$category", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        categories = await self.db[self.KNOWLEDGE_COLLECTION].aggregate(pipeline).to_list(10)

        return {
            "knowledge_entries": knowledge_count,
            "cached_translations": translation_count,
            "stored_responses": response_count,
            "idf_terms": len(self._idf),
            "total_indexed_docs": self._doc_count,
            "knowledge_categories": {c["_id"]: c["count"] for c in categories},
        }
