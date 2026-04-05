"""
SimPPL Digital Narratives Dashboard — FastAPI Backend
=====================================================
Main application entry point. Defines all API routes for:
- Health check
- Semantic search + chatbot
- Time series analytics
- Network graph (with PageRank filtering)
- Topic clustering
- Case study
- Dataset stats

Startup lifecycle:
1. Ingest data (if DuckDB is empty)
2. Load or generate FAISS index
3. Pre-build network graph (background)
"""

import os
import sys
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Add project root to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.ingest.loader import run_ingestion, get_db_connection, DUCKDB_PATH, JSONL_PATH
from backend.ingest.embeddings import run_embedding_pipeline, FAISS_INDEX_PATH
from backend.search.semantic import semantic_search, set_index
from backend.search.chatbot import (
    chatbot_response,
    summarize_timeseries,
    label_cluster,
    generate_case_study_narrative,
)
from backend.analytics.timeseries import (
    get_timeseries_all,
    get_timeseries_for_posts,
    get_engagement_timeseries,
    get_subreddit_activity,
)
from backend.analytics.network import (
    build_full_graph,
    get_filtered_graph,
    get_graph_for_posts,
)
from backend.analytics.clustering import (
    run_clustering,
    get_cluster_posts,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Startup / Shutdown lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info("🚀 Starting SimPPL Dashboard Backend...")

    # 1. Check if DuckDB has data, if not ingest
    try:
        conn = get_db_connection()
        try:
            count = conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
        except Exception:
            count = 0
        conn.close()

        if count == 0:
            logger.info("📦 DuckDB is empty. Running ingestion pipeline...")
            run_ingestion()
        else:
            logger.info(f"📦 DuckDB already has {count:,} posts. Skipping ingestion.")
    except Exception as e:
        logger.error(f"Ingestion error: {e}")
        # Try fresh ingestion
        run_ingestion()

    # 2. Load or generate FAISS index
    try:
        index, post_ids = run_embedding_pipeline()
        set_index(index, post_ids)
        logger.info(f"🔍 FAISS index ready: {index.ntotal:,} vectors")
    except Exception as e:
        logger.error(f"Embedding pipeline error: {e}")
        logger.warning("⚠️  Semantic search will be unavailable until FAISS index is built.")

    # 3. Pre-build network graph (can be slow, but we cache it)
    try:
        graph = build_full_graph()
        logger.info(f"🕸️  Network graph ready: {graph['total_nodes']} nodes, {graph['total_edges']} edges")
    except Exception as e:
        logger.error(f"Network graph error: {e}")

    logger.info("✅ Backend startup complete!")
    yield
    logger.info("👋 Shutting down SimPPL Dashboard Backend.")


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="SimPPL Digital Narratives Dashboard API",
    description="API for analyzing social media data, tracing digital narratives, and detecting influence patterns.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health & Stats
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check():
    """Health check endpoint for Render.com monitoring."""
    return {"status": "healthy", "service": "simppl-dashboard-api"}


@app.get("/api/stats")
async def get_stats():
    """Get overall dataset statistics."""
    try:
        conn = get_db_connection()
        total = conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
        authors = conn.execute("SELECT COUNT(DISTINCT author) FROM posts").fetchone()[0]
        subreddits = conn.execute("SELECT COUNT(DISTINCT subreddit) FROM posts").fetchone()[0]
        date_range = conn.execute("""
            SELECT MIN(created_utc), MAX(created_utc) FROM posts
        """).fetchone()
        avg_score = conn.execute("SELECT AVG(score) FROM posts").fetchone()[0]
        top_post = conn.execute("""
            SELECT title, score, author, subreddit FROM posts ORDER BY score DESC LIMIT 1
        """).fetchone()
        conn.close()

        return {
            "total_posts": total,
            "unique_authors": authors,
            "unique_subreddits": subreddits,
            "date_range": {
                "start": str(date_range[0]) if date_range[0] else None,
                "end": str(date_range[1]) if date_range[1] else None,
            },
            "avg_score": round(avg_score, 2) if avg_score else 0,
            "top_post": {
                "title": top_post[0] if top_post else None,
                "score": top_post[1] if top_post else 0,
                "author": top_post[2] if top_post else None,
                "subreddit": top_post[3] if top_post else None,
            } if top_post else None,
        }
    except Exception as e:
        logger.error(f"Stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Semantic Search + Chatbot
# ---------------------------------------------------------------------------

@app.get("/api/search")
async def search(
    q: str = Query("", description="Search query"),
    top_k: int = Query(10, ge=1, le=100, description="Number of results"),
):
    """
    Semantic search endpoint.
    Returns matching posts + Gemini-generated summary + follow-up suggestions.
    """
    # Handle empty/whitespace queries
    query = q.strip() if q else ""
    if not query:
        return JSONResponse(content={
            "query": "",
            "results": [],
            "error": "Query cannot be empty",
            "warning": None,
            "total_results": 0,
            "chatbot": {
                "summary": "",
                "follow_up_queries": [],
                "result_count": 0,
            },
        })

    # Run semantic search
    search_result = semantic_search(query, top_k=top_k)

    # Generate chatbot response (summary + follow-ups)
    if search_result["results"] and not search_result.get("error"):
        chatbot = chatbot_response(query, search_result["results"])
    else:
        chatbot = {
            "summary": search_result.get("error", "No results found."),
            "follow_up_queries": [],
            "result_count": 0,
        }

    return {
        **search_result,
        "chatbot": chatbot,
    }


# ---------------------------------------------------------------------------
# Time Series
# ---------------------------------------------------------------------------

@app.get("/api/timeseries")
async def timeseries(
    q: Optional[str] = Query(None, description="Optional search query to filter posts"),
    group_by: str = Query("day", description="Group by 'day' or 'week'"),
    subreddit: Optional[str] = Query(None, description="Filter by subreddit"),
    top_k: int = Query(50, ge=1, le=200, description="Number of search results for query filter"),
):
    """
    Time series endpoint.
    Returns post counts over time, optionally filtered by a semantic search query.
    Includes a Gemini-generated summary of the trend.
    """
    try:
        if q and q.strip():
            # Filter by semantic search results
            search_result = semantic_search(q.strip(), top_k=top_k)
            post_ids = [r["post_id"] for r in search_result.get("results", [])]
            data_points = get_timeseries_for_posts(post_ids)
            query_label = q.strip()
        elif subreddit:
            data_points = get_timeseries_all(group_by=group_by, subreddit=subreddit)
            query_label = f"r/{subreddit} activity"
        else:
            data_points = get_timeseries_all(group_by=group_by)
            query_label = "All posts activity"

        # Generate dynamic summary
        summary = summarize_timeseries(query_label, data_points)

        return {
            "query": query_label,
            "group_by": group_by,
            "data_points": data_points,
            "total_data_points": len(data_points),
            "summary": summary,
        }
    except Exception as e:
        logger.error(f"Time series error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/timeseries/engagement")
async def timeseries_engagement(
    group_by: str = Query("day", description="Group by 'day' or 'week'"),
    metric: str = Query("score", description="Metric: 'score', 'num_comments', or 'num_crossposts'"),
):
    """Get engagement metrics over time."""
    try:
        data = get_engagement_timeseries(group_by=group_by, metric=metric)
        return {
            "metric": metric,
            "group_by": group_by,
            "data_points": data,
            "total_data_points": len(data),
        }
    except Exception as e:
        logger.error(f"Engagement timeseries error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/subreddits")
async def subreddits():
    """Get post counts by subreddit."""
    try:
        return {"subreddits": get_subreddit_activity()}
    except Exception as e:
        logger.error(f"Subreddits error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Network Graph
# ---------------------------------------------------------------------------

@app.get("/api/network")
async def network_graph(
    min_pagerank: float = Query(0.0, ge=0.0, description="Minimum PageRank threshold"),
    community: Optional[int] = Query(None, description="Filter by community ID"),
):
    """
    Network graph endpoint.
    Returns nodes (with PageRank and community) and edges.
    Supports filtering by minimum PageRank and community.
    """
    try:
        graph = get_filtered_graph(min_pagerank=min_pagerank, community=community)

        if graph["total_nodes"] == 0 and min_pagerank == 0.0:
            return {
                **graph,
                "message": "No interactions found in the dataset.",
            }

        return graph
    except Exception as e:
        logger.error(f"Network graph error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Topic Clustering
# ---------------------------------------------------------------------------

@app.get("/api/clusters")
async def clusters(
    n_clusters: Optional[int] = Query(None, ge=2, le=50, description="Number of clusters (2-50). If not set, auto-detect with HDBSCAN."),
):
    """
    Topic clustering endpoint.
    Returns cluster assignments with 2D UMAP coordinates for visualization.
    """
    try:
        result = run_clustering(n_clusters=n_clusters)

        # Generate labels for each cluster using Gemini
        for cluster in result.get("clusters", []):
            if cluster["cluster_id"] >= 0 and cluster.get("post_ids"):
                # Get post details for labeling
                posts = get_cluster_posts(
                    cluster["cluster_id"],
                    n_clusters=n_clusters,
                    limit=10,
                )
                cluster["label"] = label_cluster(posts)
                cluster["top_posts"] = posts[:5]

        return result
    except Exception as e:
        logger.error(f"Clustering error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/clusters/{cluster_id}/posts")
async def cluster_posts(
    cluster_id: int,
    n_clusters: Optional[int] = Query(None, ge=2, le=50),
    limit: int = Query(20, ge=1, le=100),
):
    """Get posts from a specific cluster."""
    try:
        posts = get_cluster_posts(cluster_id, n_clusters=n_clusters, limit=limit)
        if not posts:
            return {"cluster_id": cluster_id, "posts": [], "message": "Cluster not found or empty."}
        return {"cluster_id": cluster_id, "posts": posts, "total": len(posts)}
    except Exception as e:
        logger.error(f"Cluster posts error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Case Study
# ---------------------------------------------------------------------------

@app.get("/api/casestudy")
async def case_study():
    """
    Case Study endpoint.
    Identifies the most interesting narrative in the dataset and returns:
    - Gemini-generated narrative summary
    - Timeline data
    - Relevant network graph
    - Related cluster information
    """
    try:
        conn = get_db_connection()

        # Find the most crossposted / discussed content (proxy for "interesting narrative")
        # Strategy: find posts with highest engagement + crossposting activity
        top_narratives = conn.execute("""
            SELECT 
                subreddit,
                COUNT(*) as post_count,
                SUM(score) as total_score,
                SUM(num_comments) as total_comments,
                SUM(num_crossposts) as total_crossposts,
                AVG(score) as avg_score
            FROM posts
            WHERE author != 'AutoModerator' AND author != '[deleted]'
            GROUP BY subreddit
            ORDER BY total_score DESC
            LIMIT 5
        """).fetchall()

        # Get the highest-engagement posts (the "story")
        key_posts = conn.execute("""
            SELECT post_id, title, selftext, content, author, created_utc,
                   subreddit, score, num_comments, permalink, crosspost_parent
            FROM posts
            WHERE author != 'AutoModerator' AND author != '[deleted]'
            ORDER BY score DESC
            LIMIT 30
        """).fetchall()

        conn.close()

        key_post_dicts = [
            {
                "post_id": row[0], "title": row[1], "selftext": (row[2] or "")[:300],
                "content": (row[3] or "")[:400], "author": row[4],
                "created_utc": str(row[5]) if row[5] else None,
                "subreddit": row[6], "score": row[7], "num_comments": row[8],
                "permalink": row[9], "crosspost_parent": row[10],
            }
            for row in key_posts
        ]

        # Get network info for the case study
        post_ids = [p["post_id"] for p in key_post_dicts]
        subgraph = get_graph_for_posts(post_ids)

        # Generate Gemini narrative
        topic = "Cross-subreddit narrative amplification in political activism communities"
        narrative = generate_case_study_narrative(
            topic, key_post_dicts, network_summary=subgraph
        )

        # Get timeline for these posts
        timeline = get_timeseries_for_posts(post_ids)
        timeline_summary = summarize_timeseries(topic, timeline)

        # Get top subreddits info
        subreddit_breakdown = [
            {
                "subreddit": row[0],
                "post_count": row[1],
                "total_score": row[2],
                "total_comments": row[3],
                "total_crossposts": row[4],
                "avg_score": round(float(row[5]), 2) if row[5] else 0,
            }
            for row in top_narratives
        ]

        return {
            "topic": topic,
            "narrative": narrative,
            "key_posts": key_post_dicts[:15],
            "timeline": {
                "data_points": timeline,
                "summary": timeline_summary,
            },
            "network": subgraph,
            "subreddit_breakdown": subreddit_breakdown,
        }

    except Exception as e:
        logger.error(f"Case study error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Run server
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
