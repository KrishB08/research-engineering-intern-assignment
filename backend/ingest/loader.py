"""
Data Ingestion Pipeline for SimPPL Dashboard
=============================================
Reads data/data.jsonl line by line, auto-detects schema from Reddit's nested
JSON structure, cleans and normalizes records, then stores everything in a
DuckDB table called `posts`.

The Reddit data has a nested format:
  { "kind": "t3", "data": { ...fields... } }

Key field mappings (auto-detected):
  - content  → data.title + " " + data.selftext
  - author   → data.author
  - timestamp → data.created_utc (Unix epoch → UTC datetime)
  - post_id   → data.id (or data.name)
  - platform  → "reddit"
  - subreddit → data.subreddit
  - score     → data.score
  - ups       → data.ups
  - downs     → data.downs
  - num_comments → data.num_comments
  - num_crossposts → data.num_crossposts
  - permalink      → data.permalink
  - url            → data.url
  - crosspost_parent → data.crosspost_parent (for network edges)
"""

import json
import os
import logging
from datetime import datetime, timezone
from typing import Optional

import duckdb

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
JSONL_PATH = os.path.join(DATA_DIR, "data.jsonl")
DUCKDB_PATH = os.path.join(DATA_DIR, "simppl.duckdb")


# ---------------------------------------------------------------------------
# Schema detection helpers
# ---------------------------------------------------------------------------

# Map of canonical field name → list of possible source keys (checked in order)
FIELD_CANDIDATES = {
    "post_id":        ["id", "name"],
    "title":          ["title"],
    "selftext":       ["selftext", "body", "text"],
    "author":         ["author", "author_fullname"],
    "created_utc":    ["created_utc", "created"],
    "subreddit":      ["subreddit", "subreddit_name_prefixed"],
    "score":          ["score"],
    "ups":            ["ups", "upvotes"],
    "downs":          ["downs", "downvotes"],
    "num_comments":   ["num_comments"],
    "num_crossposts": ["num_crossposts"],
    "permalink":      ["permalink"],
    "url":            ["url", "url_overridden_by_dest"],
    "crosspost_parent": ["crosspost_parent"],
    "over_18":        ["over_18"],
    "is_self":        ["is_self"],
    "link_flair_text": ["link_flair_text"],
    "author_flair_text": ["author_flair_text"],
    "domain":         ["domain"],
    "upvote_ratio":   ["upvote_ratio"],
}


def _detect_schema(sample_records: list[dict]) -> dict[str, str]:
    """
    Given a few sample 'data' dicts, return a mapping of
    canonical_field → actual_key found in the data.
    """
    detected = {}
    all_keys = set()
    for rec in sample_records:
        all_keys.update(rec.keys())

    for canonical, candidates in FIELD_CANDIDATES.items():
        for c in candidates:
            if c in all_keys:
                detected[canonical] = c
                break
    return detected


def _extract_data(raw: dict) -> Optional[dict]:
    """
    Given a raw JSONL record, extract the inner 'data' dict.
    Handles both nested Reddit format {"kind": ..., "data": {...}}
    and flat format where fields are at top level.
    """
    if "data" in raw and isinstance(raw["data"], dict):
        return raw["data"]
    # If flat, treat entire dict as the data
    if "author" in raw or "title" in raw or "selftext" in raw:
        return raw
    return None


def _normalize_timestamp(value) -> str:
    """Convert various timestamp formats to ISO-8601 UTC string."""
    if value is None:
        return datetime.now(timezone.utc).isoformat()
    try:
        # Unix epoch float/int
        ts = float(value)
        return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
    except (ValueError, TypeError, OSError):
        pass
    # Try ISO string parsing
    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return dt.astimezone(timezone.utc).isoformat()
        except ValueError:
            pass
    return datetime.now(timezone.utc).isoformat()


def _safe_str(value, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def _safe_int(value, default: int = 0) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def _safe_float(value, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


# ---------------------------------------------------------------------------
# Main loader
# ---------------------------------------------------------------------------

def load_jsonl(filepath: str = JSONL_PATH) -> list[dict]:
    """
    Read data.jsonl line by line, parse each record, and return
    a list of cleaned, normalized dicts ready for DuckDB insertion.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Data file not found: {filepath}")

    raw_records = []
    skipped = 0
    line_count = 0

    # --- Phase 1: Read all lines and extract inner data dicts ---
    logger.info(f"Reading JSONL from {filepath}...")
    with open(filepath, "r", encoding="utf-8") as f:
        for i, line in enumerate(f):
            line_count += 1
            line = line.strip()
            if not line:
                skipped += 1
                continue
            try:
                raw = json.loads(line)
            except json.JSONDecodeError as e:
                logger.warning(f"Skipping line {i+1}: JSON decode error: {e}")
                skipped += 1
                continue

            data = _extract_data(raw)
            if data is None:
                logger.warning(f"Skipping line {i+1}: could not extract data dict")
                skipped += 1
                continue
            raw_records.append(data)

    if not raw_records:
        raise ValueError("No valid records found in JSONL file.")

    # --- Phase 2: Inspect first 3 records (print keys for debugging) ---
    logger.info(f"Total lines read: {line_count}, valid records: {len(raw_records)}, skipped: {skipped}")
    print("\n" + "=" * 60)
    print("SCHEMA DETECTION — First 3 records' keys:")
    print("=" * 60)
    for idx, rec in enumerate(raw_records[:3]):
        print(f"\nRecord {idx + 1} keys ({len(rec.keys())} fields):")
        for k in sorted(rec.keys()):
            val = rec[k]
            val_preview = str(val)[:80] + "..." if len(str(val)) > 80 else str(val)
            print(f"  {k}: {val_preview}")
    print("=" * 60 + "\n")

    # --- Phase 3: Auto-detect schema ---
    schema_map = _detect_schema(raw_records[:10])
    logger.info(f"Detected schema mapping: {schema_map}")
    print("Detected field mapping:")
    for canonical, actual in schema_map.items():
        print(f"  {canonical} → {actual}")
    print()

    # --- Phase 4: Normalize all records ---
    cleaned = []
    seen_ids = set()
    duplicates = 0

    for rec in raw_records:
        post_id = _safe_str(rec.get(schema_map.get("post_id", "id"), ""))
        if not post_id:
            post_id = f"unknown_{len(cleaned)}"

        # Deduplicate by post_id
        if post_id in seen_ids:
            duplicates += 1
            continue
        seen_ids.add(post_id)

        title = _safe_str(rec.get(schema_map.get("title", "title"), ""))
        selftext = _safe_str(rec.get(schema_map.get("selftext", "selftext"), ""))

        # Combine title + selftext for the main content field
        content = f"{title} {selftext}".strip() if title or selftext else ""

        timestamp_raw = rec.get(schema_map.get("created_utc", "created_utc"))
        timestamp = _normalize_timestamp(timestamp_raw)

        cleaned.append({
            "post_id":          post_id,
            "title":            title,
            "selftext":         selftext,
            "content":          content,
            "author":           _safe_str(rec.get(schema_map.get("author", "author"), ""), "[deleted]"),
            "author_fullname":  _safe_str(rec.get("author_fullname", ""), ""),
            "created_utc":      timestamp,
            "subreddit":        _safe_str(rec.get(schema_map.get("subreddit", "subreddit"), ""), "unknown"),
            "platform":         "reddit",
            "score":            _safe_int(rec.get(schema_map.get("score", "score"))),
            "ups":              _safe_int(rec.get(schema_map.get("ups", "ups"))),
            "downs":            _safe_int(rec.get(schema_map.get("downs", "downs"))),
            "num_comments":     _safe_int(rec.get(schema_map.get("num_comments", "num_comments"))),
            "num_crossposts":   _safe_int(rec.get(schema_map.get("num_crossposts", "num_crossposts"))),
            "upvote_ratio":     _safe_float(rec.get(schema_map.get("upvote_ratio", "upvote_ratio"))),
            "permalink":        _safe_str(rec.get(schema_map.get("permalink", "permalink"), "")),
            "url":              _safe_str(rec.get(schema_map.get("url", "url"), "")),
            "crosspost_parent": _safe_str(rec.get(schema_map.get("crosspost_parent", "crosspost_parent"), "")),
            "domain":           _safe_str(rec.get(schema_map.get("domain", "domain"), "")),
            "is_self":          bool(rec.get(schema_map.get("is_self", "is_self"), False)),
            "over_18":          bool(rec.get(schema_map.get("over_18", "over_18"), False)),
            "link_flair_text":  _safe_str(rec.get(schema_map.get("link_flair_text", "link_flair_text"), "")),
            "author_flair_text": _safe_str(rec.get(schema_map.get("author_flair_text", "author_flair_text"), "")),
        })

    logger.info(f"Cleaned records: {len(cleaned)}, duplicates removed: {duplicates}")
    return cleaned


# ---------------------------------------------------------------------------
# DuckDB storage
# ---------------------------------------------------------------------------

def get_db_connection(db_path: str = DUCKDB_PATH) -> duckdb.DuckDBPyConnection:
    """Return a DuckDB connection, creating the file if needed."""
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = duckdb.connect(db_path)
    return conn


def create_posts_table(conn: duckdb.DuckDBPyConnection) -> None:
    """Create the `posts` table schema if it doesn't exist."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS posts (
            post_id          VARCHAR PRIMARY KEY,
            title            VARCHAR,
            selftext         VARCHAR,
            content          VARCHAR,
            author           VARCHAR,
            author_fullname  VARCHAR,
            created_utc      TIMESTAMP WITH TIME ZONE,
            subreddit        VARCHAR,
            platform         VARCHAR DEFAULT 'reddit',
            score            INTEGER DEFAULT 0,
            ups              INTEGER DEFAULT 0,
            downs            INTEGER DEFAULT 0,
            num_comments     INTEGER DEFAULT 0,
            num_crossposts   INTEGER DEFAULT 0,
            upvote_ratio     DOUBLE DEFAULT 0.0,
            permalink        VARCHAR,
            url              VARCHAR,
            crosspost_parent VARCHAR,
            domain           VARCHAR,
            is_self          BOOLEAN DEFAULT FALSE,
            over_18          BOOLEAN DEFAULT FALSE,
            link_flair_text  VARCHAR,
            author_flair_text VARCHAR
        )
    """)
    logger.info("Created/verified `posts` table schema.")


def insert_records(conn: duckdb.DuckDBPyConnection, records: list[dict]) -> int:
    """
    Insert cleaned records into the `posts` table.
    Uses INSERT OR IGNORE to handle any remaining duplicates gracefully.
    Returns count of inserted rows.
    """
    if not records:
        return 0

    insert_sql = """
        INSERT OR IGNORE INTO posts (
            post_id, title, selftext, content, author, author_fullname,
            created_utc, subreddit, platform, score, ups, downs,
            num_comments, num_crossposts, upvote_ratio, permalink, url,
            crosspost_parent, domain, is_self, over_18,
            link_flair_text, author_flair_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """

    rows = []
    for r in records:
        rows.append((
            r["post_id"], r["title"], r["selftext"], r["content"],
            r["author"], r["author_fullname"], r["created_utc"],
            r["subreddit"], r["platform"], r["score"], r["ups"], r["downs"],
            r["num_comments"], r["num_crossposts"], r["upvote_ratio"],
            r["permalink"], r["url"], r["crosspost_parent"], r["domain"],
            r["is_self"], r["over_18"], r["link_flair_text"], r["author_flair_text"],
        ))

    conn.executemany(insert_sql, rows)
    count = conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
    logger.info(f"Inserted records. Total rows in `posts`: {count}")
    return count


# ---------------------------------------------------------------------------
# Ingestion summary
# ---------------------------------------------------------------------------

def print_ingestion_summary(conn: duckdb.DuckDBPyConnection, skipped: int = 0) -> dict:
    """Print and return a summary of what was ingested."""
    total = conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
    authors = conn.execute("SELECT COUNT(DISTINCT author) FROM posts").fetchone()[0]
    subreddits = conn.execute("SELECT COUNT(DISTINCT subreddit) FROM posts").fetchone()[0]

    date_range = conn.execute("""
        SELECT
            MIN(created_utc) as earliest,
            MAX(created_utc) as latest
        FROM posts
        WHERE created_utc IS NOT NULL
    """).fetchone()

    top_subreddits = conn.execute("""
        SELECT subreddit, COUNT(*) as cnt
        FROM posts
        GROUP BY subreddit
        ORDER BY cnt DESC
        LIMIT 10
    """).fetchall()

    top_authors = conn.execute("""
        SELECT author, COUNT(*) as cnt
        FROM posts
        WHERE author != '[deleted]' AND author != 'AutoModerator'
        GROUP BY author
        ORDER BY cnt DESC
        LIMIT 10
    """).fetchall()

    avg_score = conn.execute("SELECT AVG(score) FROM posts").fetchone()[0]
    max_score = conn.execute("""
        SELECT post_id, title, score FROM posts ORDER BY score DESC LIMIT 1
    """).fetchone()

    summary = {
        "total_records": total,
        "unique_authors": authors,
        "unique_subreddits": subreddits,
        "date_range_start": str(date_range[0]) if date_range else "N/A",
        "date_range_end": str(date_range[1]) if date_range else "N/A",
        "skipped_records": skipped,
        "avg_score": round(avg_score, 2) if avg_score else 0,
    }

    print("\n" + "=" * 60)
    print("INGESTION SUMMARY")
    print("=" * 60)
    print(f"  Total records loaded:   {total:,}")
    print(f"  Unique authors:         {authors:,}")
    print(f"  Unique subreddits:      {subreddits:,}")
    print(f"  Date range:             {summary['date_range_start']} → {summary['date_range_end']}")
    print(f"  Skipped records:        {skipped}")
    print(f"  Average score:          {summary['avg_score']}")
    if max_score:
        print(f"  Highest-scored post:    [{max_score[2]}] {max_score[1][:60]}...")
    print(f"\n  Top 10 subreddits:")
    for sub, cnt in top_subreddits:
        print(f"    r/{sub}: {cnt:,} posts")
    print(f"\n  Top 10 authors:")
    for auth, cnt in top_authors:
        print(f"    u/{auth}: {cnt:,} posts")
    print("=" * 60 + "\n")

    return summary


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def run_ingestion(jsonl_path: str = JSONL_PATH, db_path: str = DUCKDB_PATH) -> dict:
    """
    Full ingestion pipeline:
    1. Read JSONL
    2. Detect schema
    3. Clean & normalize
    4. Create DuckDB table
    5. Insert records
    6. Print summary
    Returns the ingestion summary dict.
    """
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    print(f"\n🔄 Starting data ingestion from {jsonl_path}...")
    records = load_jsonl(jsonl_path)

    print(f"📦 Connecting to DuckDB at {db_path}...")
    conn = get_db_connection(db_path)
    create_posts_table(conn)

    # Check if table already has data
    existing = conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
    if existing > 0:
        print(f"⚠️  Table already has {existing:,} records. Dropping and re-inserting...")
        conn.execute("DELETE FROM posts")

    print(f"💾 Inserting {len(records):,} records into DuckDB...")
    insert_records(conn, records)

    summary = print_ingestion_summary(conn)
    conn.close()

    print("✅ Ingestion complete!")
    return summary


if __name__ == "__main__":
    run_ingestion()
