"""
Semantic Search via FAISS
=========================
Provides vector similarity search over the post embedding space.
Given a natural language query, encodes it with sentence-transformers,
queries FAISS, and returns the top-K most semantically similar posts.

Handles edge cases:
- Empty queries → returns error response
- Whitespace-only → treated as empty
- Very short queries (1-2 chars) → returns results with a warning
- Non-English input → works via multilingual embedding representation
"""

import logging
from typing import Optional

import duckdb
import numpy as np

from backend.ingest.embeddings import (
    encode_query,
    load_faiss_index,
    DUCKDB_PATH,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory cache for the loaded index
# ---------------------------------------------------------------------------
_faiss_index = None
_post_ids = None


def get_index():
    """Get the FAISS index and post IDs, loading from disk if needed."""
    global _faiss_index, _post_ids
    if _faiss_index is None or _post_ids is None:
        _faiss_index, _post_ids = load_faiss_index()
        if _faiss_index is None:
            raise RuntimeError(
                "FAISS index not found. Run the embedding pipeline first: "
                "python -m backend.ingest.embeddings"
            )
    return _faiss_index, _post_ids


def set_index(index, post_ids):
    """Set the in-memory index (used during server startup)."""
    global _faiss_index, _post_ids
    _faiss_index = index
    _post_ids = post_ids


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------

def validate_query(query: str) -> dict:
    """
    Validate and clean a search query. Returns a dict with:
    - 'query': cleaned query string
    - 'warning': optional warning message
    - 'error': error message if query is invalid
    """
    if query is None:
        return {"query": "", "error": "Query cannot be empty", "warning": None}

    cleaned = query.strip()

    if not cleaned:
        return {"query": "", "error": "Query cannot be empty", "warning": None}

    if len(cleaned) <= 2:
        return {
            "query": cleaned,
            "error": None,
            "warning": f"Very short query ('{cleaned}'). Results may be broad. Try a more descriptive query for better results."
        }

    return {"query": cleaned, "error": None, "warning": None}


# ---------------------------------------------------------------------------
# Core search function
# ---------------------------------------------------------------------------

def semantic_search(
    query: str,
    top_k: int = 10,
    db_path: str = DUCKDB_PATH,
) -> dict:
    """
    Perform semantic search over the FAISS index.

    Args:
        query: The search query string.
        top_k: Number of results to return (default 10).
        db_path: Path to the DuckDB database.

    Returns:
        dict with keys:
            - 'query': the cleaned query
            - 'results': list of matching post dicts
            - 'warning': optional warning message
            - 'error': error message if query is invalid
            - 'total_results': count of results returned
    """
    # Validate input
    validation = validate_query(query)
    if validation["error"]:
        return {
            "query": query,
            "results": [],
            "warning": None,
            "error": validation["error"],
            "total_results": 0,
        }

    cleaned_query = validation["query"]
    warning = validation.get("warning")

    # Clamp top_k to reasonable range
    top_k = max(1, min(top_k, 100))

    try:
        index, post_ids = get_index()
    except RuntimeError as e:
        return {
            "query": cleaned_query,
            "results": [],
            "warning": None,
            "error": str(e),
            "total_results": 0,
        }

    # Encode query
    query_embedding = encode_query(cleaned_query)

    # Search FAISS — returns (distances, indices) arrays
    # For IndexFlatIP with L2-normalized vectors, distances = cosine similarities
    k = min(top_k, index.ntotal)
    distances, indices = index.search(query_embedding, k)

    # Collect matching post IDs and scores
    matches = []
    for i in range(len(indices[0])):
        idx = indices[0][i]
        if idx == -1:
            continue
        matches.append({
            "post_id": post_ids[idx],
            "similarity_score": float(distances[0][i]),
        })

    if not matches:
        return {
            "query": cleaned_query,
            "results": [],
            "warning": warning,
            "error": None,
            "total_results": 0,
        }

    # Fetch full post data from DuckDB
    matched_ids = [m["post_id"] for m in matches]
    score_map = {m["post_id"]: m["similarity_score"] for m in matches}

    conn = duckdb.connect(db_path, read_only=True)

    # Build parameterized query
    placeholders = ", ".join(["?"] * len(matched_ids))
    rows = conn.execute(f"""
        SELECT post_id, title, selftext, content, author, created_utc,
               subreddit, score, num_comments, permalink, url,
               crosspost_parent, domain, upvote_ratio
        FROM posts
        WHERE post_id IN ({placeholders})
    """, matched_ids).fetchall()
    conn.close()

    # Build result dicts, preserving FAISS ranking order
    row_map = {}
    for row in rows:
        row_map[row[0]] = {
            "post_id": row[0],
            "title": row[1],
            "selftext": row[2][:500] if row[2] else "",  # Truncate for API response
            "content": row[3][:500] if row[3] else "",
            "author": row[4],
            "created_utc": str(row[5]) if row[5] else None,
            "subreddit": row[6],
            "score": row[7],
            "num_comments": row[8],
            "permalink": row[9],
            "url": row[10],
            "crosspost_parent": row[11],
            "domain": row[12],
            "upvote_ratio": row[13],
        }

    results = []
    for m in matches:
        pid = m["post_id"]
        if pid in row_map:
            result = row_map[pid]
            result["similarity_score"] = m["similarity_score"]
            results.append(result)

    return {
        "query": cleaned_query,
        "results": results,
        "warning": warning,
        "error": None,
        "total_results": len(results),
    }
