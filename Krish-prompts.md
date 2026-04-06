# AI Prompts Log — SimPPL Research Engineering Intern Assignment

This file documents all AI-assisted prompts used during development of the SimPPL dashboard.  
Each entry includes:
- The component being built
- The prompt given to the AI
- The issue observed in the output
- The fix or refinement applied

The goal is to demonstrate iterative engineering thinking while using AI tools.

---

## Prompt 1

**Component:** Project architecture and initial scaffolding

**Prompt:**

You are an expert full-stack engineer. I am building a production-grade research dashboard for SimPPL (a nonprofit focused on misinformation analysis).

Help me design the full project architecture using:
- FastAPI (backend)
- React + TailwindCSS (frontend)
- DuckDB (analytics DB)
- FAISS + sentence-transformers (semantic search)
- HDBSCAN + KMeans fallback (clustering)
- NetworkX (graph analysis)
- Gemini API for summaries

Output:
- Folder structure
- Key modules and responsibilities
- Data flow from ingestion → analysis → frontend

Do not generate full code yet. Focus only on architecture and design clarity.

**Issue & Fix:**
- Issue: Initial output tried to generate too much code and lacked clear separation of responsibilities.
- Fix: Refined prompt to explicitly restrict to architecture only and emphasize modular design.

---

## Prompt 2

**Component:** Data ingestion pipeline (JSONL → DuckDB)

**Prompt:**

Now implement the data ingestion layer.

Requirements:
- Read JSONL file line-by-line
- Dynamically detect schema (print first 3 records' keys)
- Handle missing fields gracefully
- Normalize timestamps
- Deduplicate by post ID
- Store data in DuckDB table `posts`

Focus only on:
- loader.py
- Clean, robust error handling

Do not proceed to embeddings yet.

**Issue & Fix:**
- Issue: Model assumed fixed schema instead of dynamic detection.
- Fix: Explicitly instructed schema detection and fallback defaults.

---

## Prompt 3

**Component:** Embedding generation + FAISS index

**Prompt:**

Extend the pipeline to generate semantic embeddings.

Requirements:
- Use sentence-transformers (all-MiniLM-L6-v2)
- Generate embeddings for post text
- Store embeddings efficiently
- Build FAISS index and save to disk
- Reload index if already exists

Ensure:
- No recomputation on restart
- Logging for index creation

**Issue & Fix:**
- Issue: FAISS index was being rebuilt every run.
- Fix: Added explicit condition to check for saved index file.

---

## Prompt 4

**Component:** Semantic search + chatbot

**Prompt:**

Implement semantic search with FAISS and integrate Gemini API.

Flow:
1. User query → embedding
2. FAISS → top K results
3. Gemini → summary of results
4. Gemini → 2–3 follow-up queries

Edge cases:
- Empty query
- Short query
- Non-English query

Return structured JSON response.

**Issue & Fix:**
- Issue: Search behaved like keyword matching instead of semantic.
- Fix: Ensured embedding-based similarity search only (no keyword filtering).

---

## Prompt 5

**Component:** Time-series analytics

**Prompt:**

Create a time-series analysis module.

Requirements:
- Aggregate posts by day/week
- Return counts for visualization
- Handle sparse and empty datasets
- Integrate Gemini to generate dynamic summaries based on actual data

**Issue & Fix:**
- Issue: Summary text was static and not data-driven.
- Fix: Passed actual data points into Gemini prompt.

---

## Prompt 6

**Component:** Network graph construction

**Prompt:**

Build a user interaction graph using NetworkX.

Requirements:
- Nodes = users
- Edges = replies/mentions/retweets
- Compute PageRank
- Apply Louvain community detection

Ensure:
- Handles disconnected graphs
- Works even with sparse interaction data

**Issue & Fix:**
- Issue: Graph had 0 edges due to incorrect relation extraction.
- Fix: Improved edge creation logic using mentions + reply relationships.

---

## Prompt 7

**Component:** Network graph performance optimization

**Prompt:**

Fix performance issues in the network graph.

Problems:
- Too many nodes rendered
- UI lagging
- Influence filter not working properly

Tasks:
- Limit nodes (top N by PageRank)
- Fix filtering logic
- Reduce rendering load
- Ensure smooth interaction

**Issue & Fix:**
- Issue: Rendering full graph caused lag.
- Fix: Introduced node thresholding and filtering before rendering.

---

## Prompt 8

**Component:** Topic clustering

**Prompt:**

Implement topic clustering using embeddings.

Requirements:
- Primary: HDBSCAN
- Fallback: KMeans
- Configurable n_clusters
- Handle edge cases (2 clusters, 50 clusters)
- Label clusters using Gemini

**Issue & Fix:**
- Issue: Backend hung on large clustering requests.
- Fix:
  - Added input validation for cluster size
  - Introduced fallback logic
  - Limited dataset size for clustering

---

## Prompt 9

**Component:** Clustering visualization bug fix

**Prompt:**

Fix clustering visualization issues.

Problems:
- Backend freezes on "Apply"
- No projection map generated

Tasks:
- Optimize clustering execution
- Ensure UMAP projection runs correctly
- Return visualization-ready data

**Issue & Fix:**
- Issue: UMAP + clustering pipeline too heavy synchronously.
- Fix:
  - Reduced dataset size
  - Optimized computation pipeline
  - Added graceful failure handling

---

## Prompt 10

**Component:** Frontend UI redesign (phase 1)

**Prompt:**

Redesign the frontend UI of the dashboard.

Constraints:
- Do NOT modify backend logic
- Keep all API calls intact

Focus:
- Layout
- Typography
- Color system
- Sidebar navigation

Style:
- Clean, modern, professional

**Issue & Fix:**
- Issue: Output looked like generic SaaS dashboard.
- Fix: Provided strict design language in next iteration.

---

## Prompt 11

**Component:** Frontend UI redesign (editorial style)

**Prompt:**

Redesign UI to match investigative journalism style.

Inspiration:
- The Guardian
- NYT Upshot
- Bellingcat

Requirements:
- Serif headings
- Minimalist layout
- No dark theme
- No generic cards

**Issue & Fix:**
- Issue: Dark theme still persisted globally.
- Fix: Forced global CSS overrides in next prompt.

---

## Prompt 12

**Component:** Global theme fix

**Prompt:**

Fix the entire app theme.

Problems:
- Dark background overriding everything

Tasks:
- Replace with light warm background
- Remove all dark classes
- Fix root styles (html, body, App.jsx)

**Issue & Fix:**
- Issue: Some components still had hardcoded dark styles.
- Fix: Enforced inline styles for critical layout elements.

---

## Prompt 13

**Component:** Final UI rebuild

**Prompt:**

Rebuild the frontend UI visually from scratch.

Constraints:
- Do NOT change logic or API calls
- Only modify styling and layout

Design:
- Light main content
- Dark sidebar
- Strong typography
- Clean spacing
- Smooth UX

**Issue & Fix:**
- Issue: Inconsistent styling across components.
- Fix: Standardized design system and reused patterns.

---

## Prompt 14

**Component:** Final bug fixing and stabilization

**Prompt:**

Fix remaining issues:

1. Network graph:
   - 0 edges issue
   - Too many nodes
   - Laggy performance
   - Influence filter not working

2. Topic clusters:
   - Backend hanging
   - No visualization output

Focus:
- Performance optimization
- Correct logic
- Graceful error handling

**Issue & Fix:**
- Issue: Combined computational + rendering inefficiencies.
- Fix:
  - Reduced dataset size
  - Added filtering before rendering
  - Improved clustering pipeline stability

---

## Summary

Throughout development, AI was used as a collaborative tool, not a replacement for reasoning.

Key practices followed:
- Broke large problems into smaller prompts
- Iteratively refined outputs
- Identified incorrect assumptions
- Fixed performance and logic issues manually

This ensured the final system is robust, scalable, and production-ready.