"""
Topic Clustering & Embedding Visualization
===========================================
Clusters posts using HDBSCAN (primary) with KMeans fallback.
Supports user-configurable n_clusters parameter (2-50).

HDBSCAN is preferred because:
- It automatically determines the number of clusters
- It can identify noise points (outliers)
- It handles clusters of varying density

KMeans fallback is used when:
- HDBSCAN produces degenerate results (only 1 cluster or all noise)
- The user explicitly requests a specific n_clusters value

UMAP is used for dimensionality reduction:
- n_neighbors=15 (balances local vs global structure)
- min_dist=0.1 (allows tight clusters while keeping separation)
- n_components=2 (for 2D visualization)

Handles edge cases:
- n_clusters=2: works, may show warning if not meaningful
- n_clusters=50: works or shows "too many clusters" warning
- Empty datasets: returns empty result
"""

import logging
import os
import json
from typing import Optional

import numpy as np
import duckdb
from sklearn.cluster import KMeans
from sklearn.preprocessing import normalize

try:
    import hdbscan
    HAS_HDBSCAN = True
except ImportError:
    HAS_HDBSCAN = False
    logging.warning("HDBSCAN not available. Using KMeans only.")

try:
    import umap
    HAS_UMAP = True
except ImportError:
    HAS_UMAP = False
    logging.warning("UMAP not available. Using PCA fallback for dimensionality reduction.")

from backend.ingest.embeddings import (
    DUCKDB_PATH, FAISS_INDEX_PATH, FAISS_IDS_PATH,
    load_faiss_index, get_model, EMBEDDING_DIM,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
UMAP_CACHE_PATH = os.path.join(DATA_DIR, "umap_2d.npy")
CLUSTER_CACHE_PATH = os.path.join(DATA_DIR, "cluster_cache.json")


# ---------------------------------------------------------------------------
# Get embeddings from FAISS
# ---------------------------------------------------------------------------

def _get_embeddings_and_ids() -> tuple[np.ndarray, list[str]]:
    """
    Reconstruct embeddings from the FAISS index.
    """
    import faiss

    index, post_ids = load_faiss_index()
    if index is None or post_ids is None:
        raise RuntimeError("FAISS index not found. Run embedding pipeline first.")

    # Reconstruct all vectors from FAISS
    n = index.ntotal
    embeddings = np.zeros((n, EMBEDDING_DIM), dtype=np.float32)
    for i in range(n):
        embeddings[i] = index.reconstruct(i)

    return embeddings, post_ids


# ---------------------------------------------------------------------------
# UMAP dimensionality reduction
# ---------------------------------------------------------------------------

def compute_umap_2d(
    embeddings: np.ndarray,
    n_neighbors: int = 15,
    min_dist: float = 0.1,
    force_recompute: bool = False,
) -> np.ndarray:
    """
    Reduce embeddings to 2D using UMAP.

    Parameters:
        n_neighbors=15: Balances local vs global structure
        min_dist=0.1: Allows tight clusters while maintaining separation

    Returns:
        np.ndarray of shape (N, 2) with 2D coordinates.
    """
    # Try cached result
    if not force_recompute and os.path.exists(UMAP_CACHE_PATH):
        cached = np.load(UMAP_CACHE_PATH)
        if cached.shape[0] == embeddings.shape[0]:
            logger.info(f"Loaded cached UMAP projection: {cached.shape}")
            return cached

    if not HAS_UMAP:
        # PCA fallback
        from sklearn.decomposition import PCA
        logger.warning("UMAP not available, falling back to PCA for 2D reduction.")
        pca = PCA(n_components=2, random_state=42)
        coords_2d = pca.fit_transform(embeddings)
    else:
        logger.info(f"Computing UMAP 2D projection (n_neighbors={n_neighbors}, min_dist={min_dist})...")
        reducer = umap.UMAP(
            n_neighbors=n_neighbors,
            min_dist=min_dist,
            n_components=2,
            metric="cosine",
            random_state=42,
            n_jobs=-1,
        )
        coords_2d = reducer.fit_transform(embeddings)

    # Cache result
    os.makedirs(os.path.dirname(UMAP_CACHE_PATH), exist_ok=True)
    np.save(UMAP_CACHE_PATH, coords_2d)
    logger.info(f"UMAP projection computed and cached: {coords_2d.shape}")

    return coords_2d


# ---------------------------------------------------------------------------
# Clustering
# ---------------------------------------------------------------------------

def cluster_hdbscan(
    embeddings: np.ndarray,
    min_cluster_size: int = 15,
    min_samples: int = 5,
) -> tuple[np.ndarray, str]:
    """
    Cluster embeddings using HDBSCAN.

    Returns:
        (labels, method) where labels[i] is the cluster ID for embedding i,
        and -1 indicates noise/outlier. method is 'hdbscan'.
    """
    if not HAS_HDBSCAN:
        raise ImportError("HDBSCAN not installed.")

    logger.info(f"Running HDBSCAN (min_cluster_size={min_cluster_size}, min_samples={min_samples})...")
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        metric="euclidean",
        cluster_selection_method="eom",
    )
    labels = clusterer.fit_predict(embeddings)

    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
    n_noise = (labels == -1).sum()
    logger.info(f"HDBSCAN found {n_clusters} clusters, {n_noise} noise points")

    return labels, "hdbscan"


def cluster_kmeans(
    embeddings: np.ndarray,
    n_clusters: int = 10,
) -> tuple[np.ndarray, str]:
    """
    Cluster embeddings using KMeans.
    Fallback when HDBSCAN produces degenerate results.

    Returns:
        (labels, method) where labels[i] is the cluster ID.
    """
    # Clamp n_clusters
    n_clusters = max(2, min(n_clusters, min(50, embeddings.shape[0])))

    logger.info(f"Running KMeans (n_clusters={n_clusters})...")
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10, max_iter=300)
    labels = kmeans.fit_predict(embeddings)

    logger.info(f"KMeans produced {n_clusters} clusters")
    return labels, "kmeans"


def run_clustering(
    n_clusters: Optional[int] = None,
    use_umap: bool = True,
    force_recompute: bool = False,
) -> dict:
    """
    Full clustering pipeline:
    1. Get embeddings from FAISS
    2. Optionally reduce with UMAP
    3. Cluster with HDBSCAN (primary) or KMeans (fallback)
    4. Return cluster assignments with 2D coordinates

    Args:
        n_clusters: If set, forces KMeans with this many clusters.
                   If None, uses HDBSCAN for auto-detection.
        use_umap: Whether to compute UMAP 2D projection.
        force_recompute: Force recomputation of UMAP.

    Returns:
        dict with cluster data for the frontend.
    """
    embeddings, post_ids = _get_embeddings_and_ids()

    if embeddings.shape[0] == 0:
        return {
            "clusters": [],
            "points": [],
            "n_clusters": 0,
            "method": "none",
            "warning": "No embeddings available for clustering.",
        }

    warning = None

    # --- Clustering ---
    if n_clusters is not None:
        # User specified n_clusters → use KMeans
        actual_max = min(50, embeddings.shape[0])
        if n_clusters > actual_max:
            warning = (
                f"Requested {n_clusters} clusters, but dataset only has {embeddings.shape[0]} points. "
                f"Using {actual_max} clusters instead."
            )
            n_clusters = actual_max
        elif n_clusters >= embeddings.shape[0] // 2:
            warning = (
                f"Warning: {n_clusters} clusters for {embeddings.shape[0]} posts may produce "
                f"very small or degenerate clusters. Results may not be meaningful."
            )

        labels, method = cluster_kmeans(embeddings, n_clusters)
    else:
        # Auto-detect with HDBSCAN, fallback to KMeans
        try:
            labels, method = cluster_hdbscan(embeddings)
            n_unique = len(set(labels)) - (1 if -1 in labels else 0)
            noise_ratio = (labels == -1).sum() / len(labels)

            if n_unique <= 1 or noise_ratio > 0.8:
                logger.warning(
                    f"HDBSCAN produced degenerate results ({n_unique} clusters, "
                    f"{noise_ratio:.0%} noise). Falling back to KMeans."
                )
                labels, method = cluster_kmeans(embeddings, n_clusters=10)
                warning = "HDBSCAN produced insufficient clusters. Used KMeans fallback with 10 clusters."
        except (ImportError, Exception) as e:
            logger.warning(f"HDBSCAN failed ({e}). Using KMeans fallback.")
            labels, method = cluster_kmeans(embeddings, n_clusters=10)
            warning = f"HDBSCAN unavailable. Used KMeans with 10 clusters."

    # --- UMAP 2D projection ---
    coords_2d = None
    if use_umap:
        try:
            coords_2d = compute_umap_2d(embeddings, force_recompute=force_recompute)
        except Exception as e:
            logger.error(f"UMAP failed: {e}")
            # PCA fallback
            from sklearn.decomposition import PCA
            pca = PCA(n_components=2, random_state=42)
            coords_2d = pca.fit_transform(embeddings)

    # --- Build response ---
    unique_labels = sorted(set(labels))
    n_actual_clusters = len([l for l in unique_labels if l >= 0])

    # Group posts by cluster
    cluster_groups = {}
    for i, label in enumerate(labels):
        label_int = int(label)
        if label_int not in cluster_groups:
            cluster_groups[label_int] = []
        cluster_groups[label_int].append(post_ids[i])

    clusters = []
    for label_int in sorted(cluster_groups.keys()):
        clusters.append({
            "cluster_id": label_int,
            "label": f"Cluster {label_int}" if label_int >= 0 else "Noise/Outliers",
            "size": len(cluster_groups[label_int]),
            "post_ids": cluster_groups[label_int][:20],  # Limit for API response
        })

    # Build points array for scatter plot
    points = []
    for i in range(len(post_ids)):
        point = {
            "post_id": post_ids[i],
            "cluster": int(labels[i]),
        }
        if coords_2d is not None:
            point["x"] = float(coords_2d[i][0])
            point["y"] = float(coords_2d[i][1])
        points.append(point)

    return {
        "clusters": clusters,
        "points": points,
        "n_clusters": n_actual_clusters,
        "method": method,
        "warning": warning,
        "total_points": len(points),
    }


def get_cluster_posts(
    cluster_id: int,
    n_clusters: Optional[int] = None,
    limit: int = 20,
    db_path: str = DUCKDB_PATH,
) -> list[dict]:
    """
    Get the top posts from a specific cluster.
    Runs clustering if needed and fetches post details from DuckDB.
    """
    result = run_clustering(n_clusters=n_clusters)

    # Find post IDs for the requested cluster
    target_cluster = None
    for c in result["clusters"]:
        if c["cluster_id"] == cluster_id:
            target_cluster = c
            break

    if target_cluster is None:
        return []

    post_ids = target_cluster["post_ids"][:limit]
    if not post_ids:
        return []

    conn = duckdb.connect(db_path, read_only=True)
    placeholders = ", ".join(["?"] * len(post_ids))
    rows = conn.execute(f"""
        SELECT post_id, title, selftext, author, created_utc, subreddit,
               score, num_comments, permalink
        FROM posts
        WHERE post_id IN ({placeholders})
        ORDER BY score DESC
    """, post_ids).fetchall()
    conn.close()

    return [
        {
            "post_id": row[0],
            "title": row[1],
            "selftext": (row[2] or "")[:300],
            "author": row[3],
            "created_utc": str(row[4]) if row[4] else None,
            "subreddit": row[5],
            "score": row[6],
            "num_comments": row[7],
            "permalink": row[8],
        }
        for row in rows
    ]
