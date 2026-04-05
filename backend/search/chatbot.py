"""
Gemini API Chatbot & Summary Engine
====================================
Integrates Google Gemini (gemini-1.5-flash) for:
1. Generating plain-language summaries of semantic search results
2. Proposing follow-up query suggestions
3. Dynamic chart/graph summaries
4. Case study narrative generation

All LLM calls go through this module. If the Gemini API fails,
the system degrades gracefully — returning data without summaries
rather than failing the entire request.
"""

import os
import logging
from typing import Optional

import google.generativeai as genai

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Gemini setup
# ---------------------------------------------------------------------------

_model = None


def _get_model():
    """Lazy-load the Gemini model. Configures API key from environment."""
    global _model
    if _model is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            logger.warning(
                "GEMINI_API_KEY not set. LLM features (summaries, chatbot, "
                "follow-up suggestions) will be unavailable."
            )
            return None

        genai.configure(api_key=api_key)
        _model = genai.GenerativeModel("gemini-1.5-flash")
        logger.info("Gemini model (gemini-1.5-flash) initialized.")
    return _model


def _safe_generate(prompt: str, fallback: str = "") -> str:
    """
    Call Gemini API with graceful error handling.
    Returns the generated text, or the fallback string on any failure.
    """
    model = _get_model()
    if model is None:
        return fallback

    try:
        response = model.generate_content(prompt)
        if response and response.text:
            return response.text.strip()
        return fallback
    except Exception as e:
        logger.error(f"Gemini API call failed: {e}")
        return fallback


# ---------------------------------------------------------------------------
# Search result summary
# ---------------------------------------------------------------------------

def summarize_search_results(query: str, results: list[dict]) -> str:
    """
    Generate a plain-language summary of search results.

    Args:
        query: The user's search query.
        results: List of post dicts from semantic search.

    Returns:
        A natural language summary string. Falls back to a basic
        description if Gemini is unavailable.
    """
    if not results:
        return f"No results found for the query: \"{query}\""

    # Build context from top results
    context_parts = []
    for i, r in enumerate(results[:10]):
        title = r.get("title", "")
        content = r.get("content", "")[:300]
        author = r.get("author", "unknown")
        subreddit = r.get("subreddit", "unknown")
        score = r.get("score", 0)
        context_parts.append(
            f"[Post {i+1}] r/{subreddit} by u/{author} (score: {score})\n"
            f"Title: {title}\n"
            f"Content: {content}\n"
        )

    context = "\n---\n".join(context_parts)

    prompt = f"""You are an expert research analyst helping investigate digital narratives and information spread on social media.

A user searched for: "{query}"

Here are the top {len(results)} semantically similar posts found in a Reddit dataset:

{context}

Write a clear, informative 3-5 sentence summary of what these results reveal about the query topic. Focus on:
- Common themes across the posts
- Notable patterns (e.g., are certain communities more engaged?)
- The general sentiment or perspective
- Any interesting outliers

Be analytical and specific. Do NOT just list the posts — synthesize the findings.
Keep your response under 150 words."""

    fallback = (
        f"Found {len(results)} posts related to \"{query}\" across "
        f"{len(set(r.get('subreddit', '') for r in results))} subreddits."
    )

    return _safe_generate(prompt, fallback)


# ---------------------------------------------------------------------------
# Follow-up query suggestions
# ---------------------------------------------------------------------------

def suggest_follow_ups(query: str, results: list[dict]) -> list[str]:
    """
    Generate 2-3 follow-up query suggestions based on the search results.

    Returns:
        List of suggested query strings. Falls back to generic
        suggestions if Gemini is unavailable.
    """
    if not results:
        return [
            f"Related topics to '{query}'",
            f"People discussing '{query}'",
        ]

    subreddits = list(set(r.get("subreddit", "") for r in results[:10]))
    themes = [r.get("title", "")[:80] for r in results[:5]]

    prompt = f"""Based on a user's search for "{query}" in a social media dataset, 
which returned posts from subreddits: {', '.join(subreddits[:5])},
with titles like:
{chr(10).join('- ' + t for t in themes)}

Suggest exactly 3 follow-up search queries that would help the user explore related topics or dig deeper. 
The queries should:
1. NOT repeat the original query
2. Explore different angles of the topic
3. Be natural language questions or phrases (not keywords)

Return ONLY the 3 queries, one per line, with no numbering or bullets."""

    fallback_suggestions = [
        f"How are communities responding to {query}?",
        f"Key influencers discussing {query}",
        f"Timeline of {query} discussions",
    ]

    text = _safe_generate(prompt, "")
    if not text:
        return fallback_suggestions

    # Parse the response into individual suggestions
    suggestions = [line.strip() for line in text.split("\n") if line.strip()]
    # Filter out empty or too-short lines
    suggestions = [s for s in suggestions if len(s) > 5]

    if not suggestions:
        return fallback_suggestions

    return suggestions[:3]


# ---------------------------------------------------------------------------
# Chatbot: full pipeline (search summary + follow-ups)
# ---------------------------------------------------------------------------

def chatbot_response(query: str, search_results: list[dict]) -> dict:
    """
    Full chatbot pipeline:
    1. Generate a summary of search results
    2. Generate follow-up query suggestions
    3. Return everything as a single response dict.

    Args:
        query: The user's search query.
        search_results: List of post dicts from semantic search.

    Returns:
        dict with keys: summary, follow_up_queries, result_count
    """
    summary = summarize_search_results(query, search_results)
    follow_ups = suggest_follow_ups(query, search_results)

    return {
        "summary": summary,
        "follow_up_queries": follow_ups,
        "result_count": len(search_results),
    }


# ---------------------------------------------------------------------------
# Time series summary
# ---------------------------------------------------------------------------

def summarize_timeseries(query: str, data_points: list[dict]) -> str:
    """
    Generate a dynamic summary for a time series chart.

    Args:
        query: The query that generated this time series.
        data_points: List of dicts with 'date' and 'count' keys.

    Returns:
        A plain-language description of the trend.
    """
    if not data_points:
        return f"No time series data available for \"{query}\"."

    # Build a compact data representation
    data_str = ", ".join(
        f"{dp.get('date', 'N/A')}: {dp.get('count', 0)}"
        for dp in data_points[:60]
    )
    total = sum(dp.get("count", 0) for dp in data_points)
    peak = max(data_points, key=lambda x: x.get("count", 0))

    prompt = f"""You are a data analyst interpreting a time series of social media post activity.

Query: "{query}"
Total posts: {total}
Peak date: {peak.get('date', 'N/A')} with {peak.get('count', 0)} posts
Data points (date: count): {data_str}

Write a 2-3 sentence summary describing:
1. The overall trend (increasing, decreasing, stable, spiking)
2. When the peak activity occurred and what might explain it
3. Any notable patterns (e.g., periodic bursts, sudden drops)

Be specific about dates and numbers. Keep it under 80 words."""

    fallback = (
        f"The query \"{query}\" returned {total} posts. "
        f"Peak activity was on {peak.get('date', 'N/A')} with {peak.get('count', 0)} posts."
    )

    return _safe_generate(prompt, fallback)


# ---------------------------------------------------------------------------
# Cluster labeling
# ---------------------------------------------------------------------------

def label_cluster(posts: list[dict]) -> str:
    """
    Generate a 3-5 word descriptive label for a cluster of posts.

    Args:
        posts: List of post dicts (top 10 from the cluster).

    Returns:
        A short label string.
    """
    if not posts:
        return "Uncategorized"

    titles = [p.get("title", "")[:100] for p in posts[:10]]

    prompt = f"""Here are the titles of the top 10 posts in a topic cluster from a social media dataset:

{chr(10).join('- ' + t for t in titles)}

Generate a single descriptive label for this cluster in 3-5 words.
The label should capture the common theme or topic.
Return ONLY the label, nothing else."""

    # Native fallback logic (keyword extraction) if API is offline
    fallback_label = "Topic Group"
    if posts:
        import re
        from collections import Counter
        words = []
        for p in posts:
            title = p.get('title', '')
            tokens = re.findall(r'\b[a-zA-Z]{4,}\b', title.lower())
            words.extend(tokens)
        
        stopwords = {"this", "that", "with", "from", "your", "what", "have", "they", "will", "would", "about", "there", "just", "like", "when", "their", "more", "people", "some", "them", "how", "why", "who", "which"}
        words = [w for w in words if w not in stopwords]
        
        if words:
            top_words = [w[0].title() for w in Counter(words).most_common(2)]
            fallback_label = " & ".join(top_words) + " Discussions"
        else:
            fallback_label = f"r/{posts[0].get('subreddit', 'Mixed')} Topics"

    label = _safe_generate(prompt, fallback_label)
    
    # Clean up — remove quotes, extra whitespace
    label = label.strip().strip('"').strip("'").strip()

    # Ensure it's not too long
    words = label.split()
    if len(words) > 7:
        label = " ".join(words[:5])

    return label


# ---------------------------------------------------------------------------
# Case study narrative
# ---------------------------------------------------------------------------

def generate_case_study_narrative(topic: str, posts: list[dict], network_summary: dict = None) -> str:
    """
    Generate an investigative journalism-style narrative for the case study.

    Args:
        topic: The identified topic/event.
        posts: Key posts related to this topic.
        network_summary: Optional dict with network analysis info.

    Returns:
        A multi-paragraph narrative string.
    """
    if not posts:
        return "Insufficient data to generate a case study narrative."

    context_parts = []
    for i, p in enumerate(posts[:15]):
        context_parts.append(
            f"[{p.get('created_utc', 'N/A')}] r/{p.get('subreddit', '?')} "
            f"by u/{p.get('author', '?')} (score: {p.get('score', 0)})\n"
            f"  Title: {p.get('title', '')[:120]}\n"
            f"  Content: {p.get('content', '')[:200]}"
        )

    context = "\n\n".join(context_parts)

    net_info = ""
    if network_summary:
        net_info = f"""
Network analysis reveals:
- {network_summary.get('total_nodes', 0)} accounts involved
- {network_summary.get('total_edges', 0)} interactions
- Top influencer: u/{network_summary.get('top_influencer', 'N/A')} (PageRank: {network_summary.get('top_pagerank', 0):.4f})
- {network_summary.get('num_communities', 0)} distinct communities detected
"""

    prompt = f"""You are an investigative journalist analyzing how digital narratives spread across social media.

Topic of investigation: "{topic}"

Here are key posts from the dataset:

{context}
{net_info}

Write a compelling 4-6 paragraph investigative narrative that:
1. Opens with a hook — what's the story here?
2. Describes what happened — the timeline and key events
3. Identifies the key actors and their roles
4. Analyzes how the narrative spread across communities
5. Draws conclusions about the influence patterns

Write in a professional journalistic style. Be specific about usernames, dates, and subreddits.
Use evidence from the posts. This should read like an article, not a data summary.
Keep it under 400 words."""

    fallback = (
        f"Analysis of \"{topic}\" reveals discussion across {len(set(p.get('subreddit', '') for p in posts))} "
        f"subreddits involving {len(set(p.get('author', '') for p in posts))} unique authors."
    )

    return _safe_generate(prompt, fallback)
