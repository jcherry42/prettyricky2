"""Knowledge base routes — extracted from server.py."""

from fastapi import APIRouter, HTTPException, Request
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/knowledge/stats")
async def knowledge_stats(request: Request):
    """Vector search + knowledge base statistics."""
    vs = request.app.state.vector_search
    return await vs.stats()


@router.post("/knowledge/search")
async def knowledge_search(request: Request, body: dict):
    """Semantic search across the sales knowledge base."""
    vs = request.app.state.vector_search
    query = body.get("query", "")
    category = body.get("category")
    top_k = body.get("top_k", 5)
    if not query:
        raise HTTPException(status_code=400, detail="query is required")
    results = await vs.search_knowledge(query, category=category, top_k=top_k)
    return {"results": results, "count": len(results)}


@router.post("/knowledge/seed")
async def knowledge_seed(request: Request):
    """Re-seed the sales knowledge base (idempotent)."""
    from services.sales_knowledge_base import seed_knowledge_base
    vs = request.app.state.vector_search
    count = await seed_knowledge_base(vs)
    return {"seeded": count}
