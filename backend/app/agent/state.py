"""Agent state and data models for the Perplexity MVP backend."""

from pydantic import BaseModel, Field
from typing import Any


class SearchResult(BaseModel):
    """Single web search result from the SERP API."""
    title: str
    url: str
    snippet: str
    domain: str
    # Additional fields from BrightData SERP API for richer context
    extended_snippet: str | None = None  # Longer snippet text (if different from description)
    snippet_highlighted: list[str] | None = None  # Highlighted keywords from query
    position: int | None = None  # Search ranking position
    date: str | None = None  # Publication/update date
    cite: str | None = None  # Citation format (e.g., "example.com")
    thumbnail: str | None = None  # Preview image URL
    breadcrumb: str | None = None  # Site navigation path
    keywords: list[str] | None = None  # Keywords from "about_this_result"
    cached_link: str | None = None  # Google cached page link


class Citation(BaseModel):
    """Citation used in synthesized answers."""
    id: int
    title: str
    url: str
    image: str | None = None
    extended_snippet: str | None = None  # Extended snippet from BrightData search results


class AgentState(BaseModel):
    """Tracks query, conversation history, and generated results for a single request."""
    query: str
    history: list[dict[str, Any]] = Field(default_factory=list)
    results: list[SearchResult] | None = None
    answer: str | None = None  # Kept for backward compatibility
    overview: str | None = None  # Main comprehensive overview answer
    overview_image: str | None = None  # Single image for the overview (from BrightData SERP)
    topics: list[dict[str, str]] | None = None  # List of {"title": "...", "content": "..."}
    citations: list[Citation] | None = None
    final_payload: dict | None = None

