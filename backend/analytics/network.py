"""
Network Graph Analysis
======================
Builds an interaction graph from the Reddit dataset where:
- Nodes = user accounts (authors)
- Edges = interactions (crossposting, shared subreddit activity, mentions)

Computes:
- **PageRank** for influence scoring — chosen because it captures
  not just how many connections a node has, but the *quality* of those
  connections. A user crossposted by high-influence accounts gets a
  higher score than one shared by low-activity accounts. This models
  real-world information cascades where amplification by key nodes matters.
- **Louvain community detection** for identifying clusters of users
  who interact more with each other than with the rest of the network.
  This reveals echo chambers and ideological groupings.

Handles edge cases:
- Disconnected components (renders all, labels each)
- Empty graphs (returns empty structure, not an error)
- Single-node graphs
- Filtering by minimum PageRank threshold
"""

import logging
from typing import Optional
from collections import defaultdict

import networkx as nx
import community as community_louvain  # python-louvain
import duckdb

from backend.ingest.embeddings import DUCKDB_PATH

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory graph cache
# ---------------------------------------------------------------------------
_graph_cache: Optional[dict] = None


def _build_raw_graph(db_path: str = DUCKDB_PATH) -> nx.Graph:
    """
    Build the interaction graph from DuckDB data.

    Edges are created between authors who:
    1. Crosspost each other's content (strongest signal)
    2. Share posts in the same subreddit (weak signal, weighted lower)
    3. Have crosspost_parent relationships

    Returns:
        An undirected NetworkX graph with edge weights.
    """
    conn = duckdb.connect(db_path, read_only=True)

    # Get all posts with author and crosspost info
    posts = conn.execute("""
        SELECT post_id, author, subreddit, crosspost_parent, score, 
               num_comments, created_utc, title
        FROM posts
        WHERE author IS NOT NULL AND author != '[deleted]' AND author != 'AutoModerator'
    """).fetchall()

    conn.close()

    G = nx.Graph()

    # Index posts by ID for crosspost lookup
    post_by_id = {}
    author_subreddits = defaultdict(set)
    author_posts = defaultdict(list)

    for row in posts:
        post_id, author, subreddit, crosspost_parent, score, num_comments, created_utc, title = row
        post_by_id[post_id] = {
            "author": author,
            "subreddit": subreddit,
            "score": score or 0,
            "num_comments": num_comments or 0,
            "title": str(title)[:100] if title else "",
        }
        author_subreddits[author].add(subreddit)
        author_posts[author].append({
            "post_id": post_id,
            "subreddit": subreddit,
            "score": score or 0,
        })

        # Add node with metadata
        if not G.has_node(author):
            G.add_node(author, subreddits=set(), post_count=0, total_score=0)
        G.nodes[author]["subreddits"].add(subreddit)
        G.nodes[author]["post_count"] += 1
        G.nodes[author]["total_score"] += (score or 0)

    # --- Edge Type 1: Crossposting relationships (strongest) ---
    for row in posts:
        post_id, author, subreddit, crosspost_parent, score, num_comments, created_utc, title = row
        if crosspost_parent:
            # crosspost_parent is like "t3_1irrbvc" — strip the "t3_" prefix
            parent_id = crosspost_parent.replace("t3_", "")
            if parent_id in post_by_id:
                parent_author = post_by_id[parent_id]["author"]
                if parent_author != author and parent_author and author:
                    if G.has_edge(author, parent_author):
                        G[author][parent_author]["weight"] += 3
                        G[author][parent_author]["crosspost_count"] += 1
                    else:
                        G.add_edge(
                            author, parent_author,
                            weight=3,
                            crosspost_count=1,
                            cosubreddit_count=0,
                            edge_type="crosspost",
                        )

    # --- Edge Type 2: Co-subreddit activity (weaker signal) ---
    # Authors who post in the same subreddits frequently
    subreddit_authors = defaultdict(set)
    for author, subs in author_subreddits.items():
        for sub in subs:
            subreddit_authors[sub].add(author)

    for sub, authors in subreddit_authors.items():
        authors_list = list(authors)
        # Create co-subreddit edges for subreddits up to high activity
        if len(authors_list) > 2000:
            continue  # Skip massive megathreads to prevent O(N^2) explosion
        for i in range(len(authors_list)):
            for j in range(i + 1, min(len(authors_list), i + 25)):
                a1, a2 = authors_list[i], authors_list[j]
                if G.has_edge(a1, a2):
                    G[a1][a2]["weight"] += 1
                    G[a1][a2]["cosubreddit_count"] += 1
                else:
                    G.add_edge(
                        a1, a2,
                        weight=1.0,
                        crosspost_count=0,
                        cosubreddit_count=1,
                        edge_type="co-subreddit",
                    )

    logger.info(f"Graph built: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    return G


def compute_graph_metrics(G: nx.Graph) -> dict:
    """
    Compute PageRank and Louvain communities for the graph.

    PageRank justification (in code comment above):
    PageRank is chosen over simpler centrality measures (degree, betweenness)
    because it models information flow realistically — a user's influence
    depends not just on their connections, but on the influence of those
    they're connected to. This is critical for misinformation research
    where amplification by high-influence nodes is the key mechanism.

    Returns:
        dict with 'pagerank', 'communities', 'components' info
    """
    if G.number_of_nodes() == 0:
        return {
            "pagerank": {},
            "communities": {},
            "num_communities": 0,
            "components": [],
            "num_components": 0,
        }

    # --- PageRank ---
    # damping=0.85 is the standard value (probability of following a link
    # vs. random jump). max_iter=100 ensures convergence even for large graphs.
    pagerank = nx.pagerank(G, alpha=0.85, max_iter=100, weight="weight")

    # --- Louvain Community Detection ---
    # resolution=1.0 is default; higher values produce more communities
    try:
        communities = community_louvain.best_partition(G, weight="weight", resolution=1.0)
    except Exception as e:
        logger.warning(f"Louvain community detection failed: {e}. Assigning all to community 0.")
        communities = {node: 0 for node in G.nodes()}

    num_communities = len(set(communities.values()))

    # --- Connected Components ---
    components = list(nx.connected_components(G))
    component_info = []
    for i, comp in enumerate(components):
        component_info.append({
            "component_id": i,
            "size": len(comp),
            "nodes": list(comp)[:20],  # Limit for API response size
        })

    return {
        "pagerank": pagerank,
        "communities": communities,
        "num_communities": num_communities,
        "components": component_info,
        "num_components": len(components),
    }


def build_full_graph(db_path: str = DUCKDB_PATH, force_rebuild: bool = False) -> dict:
    """
    Build the full network graph with all metrics.
    Caches the result in memory for subsequent calls.

    Returns:
        dict with graph data ready for API response
    """
    global _graph_cache
    if _graph_cache is not None and not force_rebuild:
        return _graph_cache

    logger.info("Building network graph...")
    G = _build_raw_graph(db_path)
    metrics = compute_graph_metrics(G)

    # Build serializable graph data
    nodes = []
    for node in G.nodes():
        node_data = G.nodes[node]
        nodes.append({
            "id": node,
            "label": node,
            "post_count": node_data.get("post_count", 0),
            "total_score": node_data.get("total_score", 0),
            "subreddits": list(node_data.get("subreddits", set())),
            "pagerank": round(metrics["pagerank"].get(node, 0), 6),
            "community": metrics["communities"].get(node, 0),
        })

    edges = []
    for u, v, data in G.edges(data=True):
        edges.append({
            "from": u,
            "to": v,
            "weight": data.get("weight", 1),
            "crosspost_count": data.get("crosspost_count", 0),
            "cosubreddit_count": data.get("cosubreddit_count", 0),
        })

    # Sort nodes by PageRank for filtering
    nodes.sort(key=lambda x: x["pagerank"], reverse=True)

    _graph_cache = {
        "nodes": nodes,
        "edges": edges,
        "total_nodes": len(nodes),
        "total_edges": len(edges),
        "num_communities": metrics["num_communities"],
        "num_components": metrics["num_components"],
        "components": metrics["components"],
        "top_influencer": nodes[0]["id"] if nodes else None,
        "top_pagerank": nodes[0]["pagerank"] if nodes else 0,
    }

    logger.info(
        f"Network graph complete: {len(nodes)} nodes, {len(edges)} edges, "
        f"{metrics['num_communities']} communities, {metrics['num_components']} components"
    )

    return _graph_cache


def get_filtered_graph(min_pagerank: float = 0.0, community: Optional[int] = None, max_nodes: int = 250) -> dict:
    """
    Get the graph filtered by minimum PageRank threshold and/or community.

    Args:
        min_pagerank: Minimum PageRank score to include a node.
        community: If set, only include nodes from this community.
        max_nodes: Maximum nodes to return to prevent frontend physics engine crashing.

    Returns:
        Filtered graph data dict.
    """
    full_graph = build_full_graph()

    # Filter nodes
    filtered_nodes = []
    node_ids = set()
    for node in full_graph["nodes"]:
        if len(filtered_nodes) >= max_nodes:
            break
            
        if node["pagerank"] < min_pagerank:
            continue
        if community is not None and node["community"] != community:
            continue
            
        filtered_nodes.append(node)
        node_ids.add(node["id"])

    # Filter edges to only include edges between filtered nodes
    filtered_edges = [
        edge for edge in full_graph["edges"]
        if edge["from"] in node_ids and edge["to"] in node_ids
    ]

    return {
        "nodes": filtered_nodes,
        "edges": filtered_edges,
        "total_nodes": len(filtered_nodes),
        "total_edges": len(filtered_edges),
        "num_communities": len(set(n["community"] for n in filtered_nodes)) if filtered_nodes else 0,
        "num_components": full_graph["num_components"],
        "components": full_graph["components"],
        "top_influencer": filtered_nodes[0]["id"] if filtered_nodes else None,
        "top_pagerank": filtered_nodes[0]["pagerank"] if filtered_nodes else 0,
        "filter_applied": {
            "min_pagerank": min_pagerank,
            "community": community,
        },
    }


def get_graph_for_posts(post_ids: list[str], db_path: str = DUCKDB_PATH) -> dict:
    """
    Build a subgraph for a specific set of posts (e.g., for case study).
    Only includes authors of the given posts and edges between them.
    """
    if not post_ids:
        return {
            "nodes": [], "edges": [], "total_nodes": 0, "total_edges": 0,
            "num_communities": 0, "num_components": 0, "message": "No posts provided.",
        }

    conn = duckdb.connect(db_path, read_only=True)
    placeholders = ", ".join(["?"] * len(post_ids))
    authors = conn.execute(f"""
        SELECT DISTINCT author FROM posts
        WHERE post_id IN ({placeholders})
        AND author IS NOT NULL AND author != '[deleted]'
    """, post_ids).fetchall()
    conn.close()

    author_set = set(a[0] for a in authors)

    full_graph = build_full_graph(db_path)

    filtered_nodes = [n for n in full_graph["nodes"] if n["id"] in author_set]
    node_ids = set(n["id"] for n in filtered_nodes)
    filtered_edges = [
        e for e in full_graph["edges"]
        if e["from"] in node_ids and e["to"] in node_ids
    ]

    return {
        "nodes": filtered_nodes,
        "edges": filtered_edges,
        "total_nodes": len(filtered_nodes),
        "total_edges": len(filtered_edges),
        "num_communities": len(set(n["community"] for n in filtered_nodes)) if filtered_nodes else 0,
        "num_components": 0,
    }
