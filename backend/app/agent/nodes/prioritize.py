"""Node: prioritize_sources - Rank search results by credibility using LLM."""
import json
from backend.app.agent.state import AgentState, SearchResult
from backend.app.agent.logging import AgentLogger
from backend.app.agent.prompts import PRIORITIZE_PROMPT
from backend.app.config import (
    OPENAI_API_KEY,
    OPENAI_MODEL,
    OPENAI_TEMPERATURE,
    PRIORITIZE_MAX_RESULTS,
)
from openai import OpenAI


def _normalize_url(url: str) -> str:
    """Normalize URLs for matching."""
    if not url:
        return ""
    url = url.lower().strip().rstrip("/")
    for prefix in ("http://", "https://"):
        if url.startswith(prefix):
            url = url[len(prefix):]
    if url.startswith("www."):
        url = url[4:]
    return url


def _match_url(llm_url: str, result_url: str) -> bool:
    """Compare normalized URLs or domains."""
    n1, n2 = _normalize_url(llm_url), _normalize_url(result_url)
    if n1 == n2:
        return True
    d1, d2 = n1.split("/")[0], n2.split("/")[0]
    return d1 == d2


def prioritize_sources(state: AgentState) -> AgentState:
    """
    Rank search results by credibility using LLM.
    Updates state.ranked_results with top N credible sources.
    """
    logger = AgentLogger()
    logger.start("prioritize_sources")

    results = state.results or []
    if not results:
        logger.error("prioritize_sources", "No results to prioritize.")
        state.ranked_results = []
        logger.end("prioritize_sources")
        return state

    if not OPENAI_API_KEY:
        logger.error("prioritize_sources", "OPEN_AI_KEY missing — using fallback.")
        state.ranked_results = results[:PRIORITIZE_MAX_RESULTS]
        # Set default low scores for fallback results
        for r in state.ranked_results:
            if r.reputability_score is None:
                r.reputability_score = 0.0
        logger.end("prioritize_sources")
        return state

    # Compose query
    sources_text = "\n".join([f"- {r.domain}: {r.title}" for r in results])
    prompt = f"Query: {state.query}\n\nSources:\n{sources_text}\n\n{PRIORITIZE_PROMPT}"

    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "Rank web sources by reliability."},
                {"role": "user", "content": prompt},
            ],
            temperature=OPENAI_TEMPERATURE,
        )

        content = resp.choices[0].message.content
        if not content:
            logger.error("prioritize_sources", "Empty LLM response — using fallback.")
            state.ranked_results = results[:PRIORITIZE_MAX_RESULTS]
            # Set default low scores for fallback results
            for r in state.ranked_results:
                if r.reputability_score is None:
                    r.reputability_score = 0.0
            logger.end("prioritize_sources")
            return state

        ordered = json.loads(content)
        ranked_map = {}

        # First pass: build ranked_map and assign reputability scores to SearchResults
        for entry in ordered:
            if not isinstance(entry, dict):
                continue
            url, rank = entry.get("url"), entry.get("rank")
            if not isinstance(rank, (int, float)) or not url:
                continue

            for r in results:
                if _match_url(url, r.url):
                    normalized = _normalize_url(r.url)
                    rank_int = int(rank)
                    ranked_map[normalized] = rank_int
                    # Convert rank (1-10) to reputability_score (10.0-1.0)
                    # rank 1 = most reputable → score 10.0, rank 10 = least reputable → score 1.0
                    r.reputability_score = 11.0 - float(rank_int)
                    break

        if not ranked_map:
            logger.error("prioritize_sources", "No valid LLM ranking — using fallback.")
            state.ranked_results = results[:PRIORITIZE_MAX_RESULTS]
            # Set default low scores for fallback results
            for r in state.ranked_results:
                if r.reputability_score is None:
                    r.reputability_score = 0.0
        else:
            def _score(r: SearchResult) -> int:
                return ranked_map.get(_normalize_url(r.url), 999)
            state.ranked_results = sorted(results, key=_score)[:PRIORITIZE_MAX_RESULTS]
            # Ensure all ranked results have scores (should already be set, but double-check)
            for r in state.ranked_results:
                if r.reputability_score is None:
                    # Get score from ranked_map (convert rank to score)
                    normalized = _normalize_url(r.url)
                    rank = ranked_map.get(normalized, 10)
                    r.reputability_score = 11.0 - float(rank)

    except json.JSONDecodeError as e:
        logger.error("prioritize_sources", f"Invalid JSON from LLM: {e} — using fallback.")
        state.ranked_results = results[:PRIORITIZE_MAX_RESULTS]
        # Set default low scores for fallback results
        for r in state.ranked_results:
            if r.reputability_score is None:
                r.reputability_score = 0.0
    except Exception as e:
        logger.error("prioritize_sources", f"Ranking failed: {e} — using fallback.")
        state.ranked_results = results[:PRIORITIZE_MAX_RESULTS]
        # Set default low scores for fallback results
        for r in state.ranked_results:
            if r.reputability_score is None:
                r.reputability_score = 0.0

    logger.end("prioritize_sources")
    return state

