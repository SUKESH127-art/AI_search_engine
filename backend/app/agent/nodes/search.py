"""Bright Data SERP API search node."""
import json
from urllib.parse import urlparse, quote
import requests
from backend.app.agent.state import AgentState, SearchResult
from backend.app.agent.logging import AgentLogger
from backend.app.config import (
    BRIGHT_DATA_API_KEY,
    SERPAPI_API_KEY,
    SERP_ZONE,
    HTTP_TIMEOUT_SEARCH,
)

def search(state: AgentState) -> AgentState:
    logger = AgentLogger()
    logger.start("search")

    # Get Bright Data API credentials
    api_key = BRIGHT_DATA_API_KEY or SERPAPI_API_KEY
    
    if not api_key:
        logger.error("search", "BRIGHT_DATA_API_KEY or SERPAPI_API_KEY not found")
        state.results = []
        logger.end("search")
        return state
    
    if not SERP_ZONE:
        logger.error("search", "SERP_ZONE not found")
        state.results = []
        logger.end("search")
        return state
    
    # Build Google search URL
    query = state.query
    search_url = f"https://www.google.com/search?q={quote(query)}&hl=en&gl=us&num=10"
    
    # Make request to Bright Data SERP API
    # Use Fast Parser for 2x speed improvement (parsed_light focuses on top 10 results)
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "x-unblock-data-format": "parsed_light",  # Fast parser - 2x speed, top 10 results only
    }
    
    payload = {
        "zone": SERP_ZONE,
        "url": f"{search_url}&brd_json=1",  # Add brd_json=1 for parsed JSON output
        "format": "json",  # Use "json" for parsed output (not "raw")
    }
    
    try:
        response = requests.post(
            "https://api.brightdata.com/request",
            headers=headers,
            json=payload,
            timeout=HTTP_TIMEOUT_SEARCH
        )
        response.raise_for_status()
        api_response = response.json()
        
        # Bright Data returns {status_code, headers, body}
        # The actual JSON data is in the "body" field
        body = api_response.get("body", {})
        
        # If body is a string, parse it as JSON
        if isinstance(body, str):
            body = json.loads(body)
        
        # Extract overview image from SERP response (priority: knowledge_graph > images > top result thumbnail)
        overview_image = None
        
        # Try knowledge_graph image first (most relevant for queries)
        knowledge_graph = body.get("knowledge_graph", {})
        if isinstance(knowledge_graph, dict):
            kg_image = knowledge_graph.get("image")
            if kg_image and isinstance(kg_image, str):
                overview_image = kg_image
                logger.emit("search", "info", "Found knowledge_graph image")
        
        # Try images section (first image result)
        if not overview_image:
            images = body.get("images", [])
            if isinstance(images, list) and len(images) > 0:
                first_image = images[0]
                if isinstance(first_image, dict):
                    img_url = first_image.get("original") or first_image.get("link") or first_image.get("thumbnail")
                    if img_url:
                        overview_image = img_url
                        logger.emit("search", "info", "Found image from images section")
        
        # Fallback to top organic result thumbnail
        if not overview_image:
            organic_results = body.get("organic", [])
            if organic_results and len(organic_results) > 0:
                top_result = organic_results[0]
                if isinstance(top_result, dict):
                    # Try thumbnail first, then fallback to any available image field
                    thumbnail = top_result.get("thumbnail")
                    if thumbnail:
                        overview_image = thumbnail
                        logger.emit("search", "info", "Using top result thumbnail as overview image")
                    else:
                        # Try other possible image fields
                        for img_field in ["image", "og_image", "preview_image"]:
                            img_url = top_result.get(img_field)
                            if img_url:
                                overview_image = img_url
                                logger.emit("search", "info", f"Using top result {img_field} as overview image")
                                break
        
        # Store overview image in state
        state.overview_image = overview_image
        
        # Parse Bright Data response format
        # Organic results are directly in body.organic array
        # Search 10 sources, but we'll use top 5 in synthesis
        organic_results = body.get("organic", [])[:10]  # Limit to 10 results
        
        state.results = []
        for r in organic_results:
            if not r.get("link"):
                continue
            
            # Extract base fields
            link = r.get("link", "")
            description = r.get("description", "")
            snippet = r.get("snippet", "")  # Extended snippet from BrightData
            
            # Extract additional fields for richer context
            about_this_result = r.get("about_this_result", {})
            keywords_list = about_this_result.get("keywords", []) if isinstance(about_this_result, dict) else []
            
            # Use description as primary snippet, snippet as extended_snippet
            # BrightData typically has "description" (short) and "snippet" (extended)
            primary_snippet = description or snippet or ""
            # Always include snippet as extended_snippet when available
            # If snippet not available, use description as extended_snippet for richer context
            extended_snippet = snippet if snippet else (description if description else None)
            
            state.results.append(SearchResult(
                title=r.get("title", ""),
                url=link,
                snippet=primary_snippet,
                domain=urlparse(link).netloc,
                # Additional context fields
                extended_snippet=extended_snippet,
                snippet_highlighted=r.get("snippet_highlighted") if isinstance(r.get("snippet_highlighted"), list) else None,
                position=r.get("position") if isinstance(r.get("position"), int) else None,
                date=r.get("date"),
                cite=r.get("cite"),
                thumbnail=r.get("thumbnail"),
                breadcrumb=r.get("breadcrumb"),
                keywords=keywords_list if keywords_list else None,
                cached_link=r.get("cached_page_link")
            ))
    except requests.exceptions.RequestException as e:
        logger.error("search", f"API request failed: {str(e)}")
        state.results = []

    logger.end("search")
    return state

