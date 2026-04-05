"""
Time Series Analytics
=====================
Provides endpoints for querying post volume over time.
Given a search query, returns post counts grouped by day or week,
optionally filtered by semantic search results.

Handles edge cases:
- Sparse data with few data points
- Single data point
- Empty result sets
- Custom date grouping (day/week)
"""

import logging
from typing import Optional

import duckdb

from backend.ingest.embeddings import DUCKDB_PATH

logger = logging.getLogger(__name__)


def get_timeseries_all(
    db_path: str = DUCKDB_PATH,
    group_by: str = "day",
    subreddit: Optional[str] = None,
) -> list[dict]:
    """
    Get post counts over time for ALL posts in the dataset.

    Args:
        db_path: Path to DuckDB database.
        group_by: 'day' or 'week'.
        subreddit: Optional subreddit filter.

    Returns:
        List of dicts with 'date' and 'count' keys.
    """
    conn = duckdb.connect(db_path, read_only=True)

    if group_by == "week":
        date_expr = "DATE_TRUNC('week', created_utc)"
    else:
        date_expr = "DATE_TRUNC('day', created_utc)"

    where_clause = ""
    params = []
    if subreddit:
        where_clause = "WHERE subreddit = ?"
        params.append(subreddit)

    query = f"""
        SELECT
            CAST({date_expr} AS DATE) as date,
            COUNT(*) as count
        FROM posts
        {where_clause}
        GROUP BY date
        ORDER BY date
    """

    rows = conn.execute(query, params).fetchall()
    conn.close()

    return [{"date": str(row[0]), "count": row[1]} for row in rows]


def get_timeseries_for_posts(
    post_ids: list[str],
    db_path: str = DUCKDB_PATH,
    group_by: str = "day",
) -> list[dict]:
    """
    Get post counts over time for a specific set of post IDs
    (e.g., from semantic search results).

    Args:
        post_ids: List of post IDs to filter by.
        db_path: Path to DuckDB database.
        group_by: 'day' or 'week'.

    Returns:
        List of dicts with 'date' and 'count' keys.
    """
    if not post_ids:
        return []

    conn = duckdb.connect(db_path, read_only=True)

    if group_by == "week":
        date_expr = "DATE_TRUNC('week', created_utc)"
    else:
        date_expr = "DATE_TRUNC('day', created_utc)"

    placeholders = ", ".join(["?"] * len(post_ids))
    query = f"""
        SELECT
            CAST({date_expr} AS DATE) as date,
            COUNT(*) as count
        FROM posts
        WHERE post_id IN ({placeholders})
        GROUP BY date
        ORDER BY date
    """

    rows = conn.execute(query, post_ids).fetchall()
    conn.close()

    return [{"date": str(row[0]), "count": row[1]} for row in rows]


def get_engagement_timeseries(
    db_path: str = DUCKDB_PATH,
    group_by: str = "day",
    metric: str = "score",
) -> list[dict]:
    """
    Get engagement metrics aggregated over time.

    Args:
        db_path: Path to DuckDB database.
        group_by: 'day' or 'week'.
        metric: 'score', 'num_comments', or 'num_crossposts'.

    Returns:
        List of dicts with 'date', 'avg_metric', 'total_metric', and 'count'.
    """
    valid_metrics = {"score", "num_comments", "num_crossposts"}
    if metric not in valid_metrics:
        metric = "score"

    conn = duckdb.connect(db_path, read_only=True)

    if group_by == "week":
        date_expr = "DATE_TRUNC('week', created_utc)"
    else:
        date_expr = "DATE_TRUNC('day', created_utc)"

    query = f"""
        SELECT
            CAST({date_expr} AS DATE) as date,
            COUNT(*) as count,
            ROUND(AVG({metric}), 2) as avg_metric,
            SUM({metric}) as total_metric
        FROM posts
        GROUP BY date
        ORDER BY date
    """

    rows = conn.execute(query).fetchall()
    conn.close()

    return [
        {
            "date": str(row[0]),
            "count": row[1],
            "avg_metric": float(row[2]) if row[2] else 0,
            "total_metric": int(row[3]) if row[3] else 0,
        }
        for row in rows
    ]


def get_subreddit_activity(db_path: str = DUCKDB_PATH) -> list[dict]:
    """
    Get post counts by subreddit, sorted by count descending.
    """
    conn = duckdb.connect(db_path, read_only=True)
    rows = conn.execute("""
        SELECT subreddit, COUNT(*) as count, AVG(score) as avg_score
        FROM posts
        GROUP BY subreddit
        ORDER BY count DESC
        LIMIT 50
    """).fetchall()
    conn.close()

    return [
        {
            "subreddit": row[0],
            "count": row[1],
            "avg_score": round(float(row[2]), 2) if row[2] else 0,
        }
        for row in rows
    ]
