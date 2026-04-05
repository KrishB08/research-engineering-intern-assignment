"""
Embedding Generation & FAISS Index Management
==============================================
Generates dense vector embeddings for all post content using
sentence-transformers (all-MiniLM-L6-v2, 384-dimensional) and stores
them in a FAISS IndexFlatIP (inner product / cosine similarity on
L2-normalized vectors) for fast semantic search.

The FAISS index is persisted to `data/faiss.index` so it doesn't
regenerate on every server restart. If the index file is missing,
the system regenerates it automatically and logs a warning.

Post IDs are stored alongside the index in `data/faiss_ids.json`
to map FAISS result indices back to DuckDB post_ids.
"""

import json
import os
import logging
import time
from typing import Optional

import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

import duckdb

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths & Config
# ---------------------------------------------------------------------------
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
DUCKDB_PATH = os.path.join(DATA_DIR, "simppl.duckdb")
FAISS_INDEX_PATH = os.path.join(DATA_DIR, "faiss.index")
FAISS_IDS_PATH = os.path.join(DATA_DIR, "faiss_ids.json")

# Model config
MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384
BATCH_SIZE = 256  # Encode in batches for memory efficiency


# ---------------------------------------------------------------------------
# Singleton model loader
# ---------------------------------------------------------------------------
_model: Optional[SentenceTransformer] = None


def get_model() -> SentenceTransformer:
    """Lazy-load the sentence transformer model (singleton)."""
    global _model
    if _model is None:
        logger.info(f"Loading sentence-transformers model: {MODEL_NAME}...")
        _model = SentenceTransformer(MODEL_NAME)
        logger.info(f"Model loaded. Embedding dimension: {EMBEDDING_DIM}")
    return _model


# ---------------------------------------------------------------------------
# Embedding generation
# ---------------------------------------------------------------------------

def generate_embeddings(
    texts: list[str],
    batch_size: int = BATCH_SIZE,
    show_progress: bool = True
) -> np.ndarray:
    """
    Generate L2-normalized embeddings for a list of texts.

    Returns:
        np.ndarray of shape (len(texts), EMBEDDING_DIM), float32, L2-normalized.
    """
    model = get_model()

    if not texts:
        return np.empty((0, EMBEDDING_DIM), dtype=np.float32)

    # Replace empty/None texts with a placeholder to avoid encoding errors
    clean_texts = [t if t and t.strip() else "[empty]" for t in texts]

    logger.info(f"Generating embeddings for {len(clean_texts):,} texts (batch_size={batch_size})...")
    start = time.time()

    embeddings = model.encode(
        clean_texts,
        batch_size=batch_size,
        show_progress_bar=show_progress,
        normalize_embeddings=True,  # L2-normalize for cosine similarity via inner product
        convert_to_numpy=True,
    )

    elapsed = time.time() - start
    logger.info(f"Embeddings generated in {elapsed:.1f}s ({len(clean_texts)/elapsed:.0f} texts/sec)")

    return embeddings.astype(np.float32)


def encode_query(query: str) -> np.ndarray:
    """
    Encode a single query string into a normalized embedding vector.

    Returns:
        np.ndarray of shape (1, EMBEDDING_DIM), float32, L2-normalized.
    """
    if not query or not query.strip():
        # Return a zero vector for empty queries — will match nothing
        return np.zeros((1, EMBEDDING_DIM), dtype=np.float32)

    model = get_model()
    embedding = model.encode(
        [query],
        normalize_embeddings=True,
        convert_to_numpy=True,
    )
    return embedding.astype(np.float32)


# ---------------------------------------------------------------------------
# FAISS index management
# ---------------------------------------------------------------------------

def build_faiss_index(embeddings: np.ndarray) -> faiss.IndexFlatIP:
    """
    Build a FAISS IndexFlatIP (inner product = cosine similarity on
    L2-normalized vectors). This is an exact search index — fast enough
    for <100K vectors, no training required.

    Args:
        embeddings: np.ndarray of shape (N, EMBEDDING_DIM), L2-normalized.

    Returns:
        faiss.IndexFlatIP with all embeddings added.
    """
    if embeddings.shape[0] == 0:
        raise ValueError("Cannot build FAISS index with empty embeddings.")

    logger.info(f"Building FAISS IndexFlatIP with {embeddings.shape[0]:,} vectors, dim={embeddings.shape[1]}...")
    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(embeddings)
    logger.info(f"FAISS index built. Total vectors: {index.ntotal:,}")
    return index


def save_faiss_index(index: faiss.IndexFlatIP, post_ids: list[str],
                     index_path: str = FAISS_INDEX_PATH,
                     ids_path: str = FAISS_IDS_PATH) -> None:
    """Save the FAISS index and corresponding post ID list to disk."""
    os.makedirs(os.path.dirname(index_path), exist_ok=True)
    faiss.write_index(index, index_path)
    with open(ids_path, "w") as f:
        json.dump(post_ids, f)
    logger.info(f"FAISS index saved to {index_path} ({index.ntotal:,} vectors)")
    logger.info(f"Post IDs saved to {ids_path}")


def load_faiss_index(index_path: str = FAISS_INDEX_PATH,
                     ids_path: str = FAISS_IDS_PATH) -> tuple[Optional[faiss.IndexFlatIP], Optional[list[str]]]:
    """
    Load a saved FAISS index and post ID list from disk.

    Returns:
        (index, post_ids) or (None, None) if files don't exist.
    """
    if not os.path.exists(index_path) or not os.path.exists(ids_path):
        logger.warning(f"FAISS index not found at {index_path} — will need to regenerate.")
        return None, None

    logger.info(f"Loading FAISS index from {index_path}...")
    index = faiss.read_index(index_path)
    with open(ids_path, "r") as f:
        post_ids = json.load(f)

    logger.info(f"FAISS index loaded: {index.ntotal:,} vectors, {len(post_ids):,} post IDs")

    if index.ntotal != len(post_ids):
        logger.error(f"Mismatch: FAISS has {index.ntotal} vectors but {len(post_ids)} post IDs. Regenerating...")
        return None, None

    return index, post_ids


# ---------------------------------------------------------------------------
# Full pipeline
# ---------------------------------------------------------------------------

def run_embedding_pipeline(db_path: str = DUCKDB_PATH, force_rebuild: bool = False) -> tuple[faiss.IndexFlatIP, list[str]]:
    """
    Full embedding pipeline:
    1. Try to load existing FAISS index from disk
    2. If not found or force_rebuild, generate embeddings from DuckDB and build new index
    3. Save the index to disk
    4. Return (index, post_ids)
    """
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    # Try loading existing index
    if not force_rebuild:
        index, post_ids = load_faiss_index()
        if index is not None and post_ids is not None:
            print(f"✅ Loaded existing FAISS index: {index.ntotal:,} vectors")
            return index, post_ids
        else:
            logger.warning("⚠️  FAISS index missing or corrupted. Regenerating automatically...")

    # Read post content from DuckDB
    print(f"📊 Reading post content from DuckDB at {db_path}...")
    conn = duckdb.connect(db_path, read_only=True)
    rows = conn.execute("SELECT post_id, content FROM posts ORDER BY post_id").fetchall()
    conn.close()

    if not rows:
        raise ValueError("No posts found in DuckDB. Run ingestion first.")

    post_ids = [row[0] for row in rows]
    contents = [row[1] for row in rows]

    print(f"🧠 Generating embeddings for {len(contents):,} posts with {MODEL_NAME}...")
    embeddings = generate_embeddings(contents)

    print(f"🔍 Building FAISS index...")
    index = build_faiss_index(embeddings)

    print(f"💾 Saving FAISS index to {FAISS_INDEX_PATH}...")
    save_faiss_index(index, post_ids)

    print(f"✅ Embedding pipeline complete! {index.ntotal:,} vectors indexed.")
    return index, post_ids


if __name__ == "__main__":
    run_embedding_pipeline(force_rebuild=True)
