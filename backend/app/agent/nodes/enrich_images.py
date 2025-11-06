"""Image enrichment node: Fetches images for each citation using BrightData SERP image search."""
import json
from urllib.parse import quote, urlparse
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from backend.app.agent.state import AgentState, Citation
from backend.app.agent.logging import AgentLogger
from backend.app.config import (
    BRIGHT_DATA_API_KEY,
    SERPAPI_API_KEY,
    SERP_ZONE,
    HTTP_TIMEOUT_SEARCH,
)


def _search_image_for_citation(citation_title: str, query_context: str, api_key: str, zone: str, logger: AgentLogger, citation_url: str | None = None) -> str | None:
    """
    Search for an image using BrightData SERP API image search.
    Returns the first image URL found, or None if no image is found.
    """
    # Build image search query - combine citation title with query context for better results
    # Extract key terms from query context (first few words)
    query_terms = query_context.split()[:3] if query_context else []
    query_snippet = " ".join(query_terms) if query_terms else ""
    
    # Construct search query: use citation title + relevant query terms
    if query_snippet:
        image_query = f"{citation_title} {query_snippet}"
    else:
        image_query = citation_title
    
    # Clean up the query - remove common stopwords and limit length
    image_query = image_query.strip()[:100]  # Limit to 100 chars
    
    logger.emit("enrich_images", "debug", f"Image search query: {image_query[:80]}")
    
    # Build Google image search URL (tbm=isch for image search)
    search_url = f"https://www.google.com/search?q={quote(image_query)}&tbm=isch&hl=en&gl=us&num=10"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "x-unblock-data-format": "parsed_light",
    }
    
    payload = {
        "zone": zone,
        "url": f"{search_url}&brd_json=1",
        "format": "json",
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
        
        # Extract body
        body = api_response.get("body", {})
        if isinstance(body, str):
            body = json.loads(body)
        
        # Extract first image from image search results
        images = body.get("images", [])
        if isinstance(images, list) and len(images) > 0:
            # Try first few images in case first one fails
            for image_item in images[:5]:
                if isinstance(image_item, dict):
                    # Try different image URL fields in order of preference
                    # Skip 'link' field as it's usually a page URL, not an image URL
                    img_url = (
                        image_item.get("original") or 
                        image_item.get("url") or
                        image_item.get("src") or
                        image_item.get("thumbnail") or
                        image_item.get("image")
                    )
                    # For image search results, accept any URL unless it's clearly a page URL
                    if img_url and isinstance(img_url, str):
                        if img_url.startswith(('http://', 'https://')):
                            # Reject obvious page URLs (HTML pages, Wikipedia articles, etc.)
                            if any(blocker in img_url.lower() for blocker in ['/wiki/', '.html', '/discover/', '/article/', '/page/', '?q=']):
                                continue
                            # Since we're doing image search (tbm=isch), trust the results
                            # Accept the URL (we've already filtered out page URLs above)
                            logger.emit("enrich_images", "debug", f"Found image URL: {img_url[:60]}...")
                            return img_url
                        elif img_url.startswith('data:image'):
                            # Base64 image data URI
                            logger.emit("enrich_images", "debug", "Found base64 image data")
                            return img_url
        
        # Fallback: try organic results with thumbnails (but validate they're image URLs)
        organic_results = body.get("organic", [])
        for result in organic_results[:5]:  # Check top 5 results
            if isinstance(result, dict):
                thumbnail = result.get("thumbnail")
                if thumbnail and isinstance(thumbnail, str):
                    if thumbnail.startswith(('http://', 'https://')):
                        # Validate it's an image URL
                        if (any(thumbnail.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp']) or
                            any(domain in thumbnail.lower() for domain in ['googleusercontent.com', 'gstatic.com', 'imgur.com', 'i.imgur.com', 'images.unsplash.com']) or
                            '/image/' in thumbnail.lower() or '/img/' in thumbnail.lower() or
                            thumbnail.startswith('data:image')):
                            return thumbnail
        
        # Final fallback: if no image found and we have a citation URL, search by website name
        if citation_url:
            try:
                parsed_url = urlparse(citation_url)
                domain = parsed_url.netloc or parsed_url.path
                # Remove www. prefix and get clean domain name
                domain = domain.replace('www.', '').split('/')[0]
                
                if domain:
                    logger.emit("enrich_images", "debug", f"Trying fallback search with domain: {domain}")
                    # Search for images using just the domain/website name
                    fallback_query = domain
                    fallback_search_url = f"https://www.google.com/search?q={quote(fallback_query)}&tbm=isch&hl=en&gl=us&num=10"
                    
                    fallback_payload = {
                        "zone": zone,
                        "url": f"{fallback_search_url}&brd_json=1",
                        "format": "json",
                    }
                    
                    fallback_response = requests.post(
                        "https://api.brightdata.com/request",
                        headers=headers,
                        json=fallback_payload,
                        timeout=HTTP_TIMEOUT_SEARCH
                    )
                    fallback_response.raise_for_status()
                    fallback_api_response = fallback_response.json()
                    
                    fallback_body = fallback_api_response.get("body", {})
                    if isinstance(fallback_body, str):
                        fallback_body = json.loads(fallback_body)
                    
                    # Get first image from fallback search
                    fallback_images = fallback_body.get("images", [])
                    if isinstance(fallback_images, list) and len(fallback_images) > 0:
                        for image_item in fallback_images[:3]:  # Try first 3
                            if isinstance(image_item, dict):
                                img_url = (
                                    image_item.get("original") or 
                                    image_item.get("url") or
                                    image_item.get("src") or
                                    image_item.get("thumbnail") or
                                    image_item.get("image")
                                )
                                if img_url and isinstance(img_url, str):
                                    if img_url.startswith(('http://', 'https://')):
                                        # Reject obvious page URLs
                                        if any(blocker in img_url.lower() for blocker in ['/wiki/', '.html', '/discover/', '/article/', '/page/', '?q=']):
                                            continue
                                        logger.emit("enrich_images", "info", f"Found fallback image via domain search: {img_url[:60]}...")
                                        return img_url
                                    elif img_url.startswith('data:image'):
                                        logger.emit("enrich_images", "info", "Found fallback base64 image via domain search")
                                        return img_url
            except Exception as e:
                logger.emit("enrich_images", "debug", f"Fallback domain search failed: {str(e)[:100]}")
        
        return None
        
    except requests.exceptions.RequestException as e:
        logger.emit("enrich_images", "warning", f"Image search failed for '{citation_title[:50]}': {str(e)[:100]}")
        return None
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        logger.emit("enrich_images", "warning", f"Image search parsing failed for '{citation_title[:50]}': {str(e)[:100]}")
        return None


def _search_overview_image(query: str, api_key: str, zone: str, logger: AgentLogger) -> str | None:
    """
    Search for an overview image using BrightData SERP API image search.
    Returns the first image URL found, or None if no image is found.
    """
    # Build image search query from the main query
    image_query = query.strip()[:100]  # Limit to 100 chars
    
    logger.emit("enrich_images", "debug", f"Overview image search query: {image_query[:80]}")
    
    # Build Google image search URL (tbm=isch for image search)
    search_url = f"https://www.google.com/search?q={quote(image_query)}&tbm=isch&hl=en&gl=us&num=10"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "x-unblock-data-format": "parsed_light",
    }
    
    payload = {
        "zone": zone,
        "url": f"{search_url}&brd_json=1",
        "format": "json",
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
        
        # Extract body
        body = api_response.get("body", {})
        if isinstance(body, str):
            body = json.loads(body)
        
        # Extract first image from image search results
        images = body.get("images", [])
        if isinstance(images, list) and len(images) > 0:
            # Try first few images in case first one fails
            for image_item in images[:5]:
                if isinstance(image_item, dict):
                    # Try different image URL fields in order of preference
                    # Skip 'link' field as it's usually a page URL, not an image URL
                    img_url = (
                        image_item.get("original") or 
                        image_item.get("url") or
                        image_item.get("src") or
                        image_item.get("thumbnail") or
                        image_item.get("image")
                    )
                    # For image search results, accept any URL unless it's clearly a page URL
                    if img_url and isinstance(img_url, str):
                        if img_url.startswith(('http://', 'https://')):
                            # Reject obvious page URLs (HTML pages, Wikipedia articles, etc.)
                            if any(blocker in img_url.lower() for blocker in ['/wiki/', '.html', '/discover/', '/article/', '/page/', '?q=']):
                                continue
                            # Since we're doing image search (tbm=isch), trust the results
                            # Accept if it looks like an image OR if it's from image search (which it always is here)
                            if (any(img_url.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico']) or
                                any(domain in img_url.lower() for domain in ['googleusercontent.com', 'gstatic.com', 'imgur.com', 'i.imgur.com', 'images.unsplash.com', 'cdn', 'image', 'img', 'photo', 'pic']) or
                                '/image/' in img_url.lower() or '/img/' in img_url.lower() or
                                True):  # Always True - we're in image search, so trust results
                                logger.emit("enrich_images", "debug", f"Found overview image URL: {img_url[:60]}...")
                                return img_url
                        elif img_url.startswith('data:image'):
                            # Base64 image data URI
                            logger.emit("enrich_images", "debug", "Found base64 overview image data")
                            return img_url
        
        return None
        
    except requests.exceptions.RequestException as e:
        logger.emit("enrich_images", "warning", f"Overview image search failed: {str(e)[:100]}")
        return None
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        logger.emit("enrich_images", "warning", f"Overview image search parsing failed: {str(e)[:100]}")
        return None


def enrich_images(state: AgentState) -> AgentState:
    """
    Enrich each citation with an image from BrightData SERP image search.
    Also fetches overview image if missing.
    Uses the citation title + query context to search for relevant images.
    """
    logger = AgentLogger()
    logger.start("enrich_images")
    
    # Get API credentials
    api_key = BRIGHT_DATA_API_KEY or SERPAPI_API_KEY
    zone = SERP_ZONE
    
    if not api_key or not zone:
        logger.emit("enrich_images", "warning", "Missing API credentials for image search - skipping images")
        logger.end("enrich_images")
        return state
    
    # Fetch overview image if missing
    if not state.overview_image:
        logger.emit("enrich_images", "info", "No overview image found, searching for one...")
        query = state.query or ""
        if query:
            overview_image = _search_overview_image(query, api_key, zone, logger)
            if overview_image:
                state.overview_image = overview_image
                logger.emit("enrich_images", "info", f"Found overview image: {overview_image[:50]}...")
            else:
                logger.emit("enrich_images", "warning", "Could not find overview image")
        else:
            logger.emit("enrich_images", "warning", "No query available for overview image search")
    else:
        logger.emit("enrich_images", "info", f"Overview image already available: {state.overview_image[:50]}...")
    
    # Get citations to enrich
    citations = state.citations or []
    if not citations:
        logger.emit("enrich_images", "info", "No citations to enrich with images")
        logger.end("enrich_images")
        return state
    
    logger.emit("enrich_images", "info", f"Enriching {len(citations)} citations with images...")
    
    # Enrich each citation with an image using parallel processing
    query_context = state.query or ""
    enriched_count = 0
    
    # Separate citations that already have images vs those that need images
    citations_to_enrich = []
    for citation in citations:
        if citation.image is not None and citation.image.strip():
            logger.emit("enrich_images", "debug", f"Citation {citation.id} already has image")
            enriched_count += 1
        else:
            citations_to_enrich.append(citation)
    
    if not citations_to_enrich:
        logger.emit("enrich_images", "info", f"All {len(citations)} citations already have images")
        logger.end("enrich_images")
        return state
    
    logger.emit("enrich_images", "info", f"Fetching images for {len(citations_to_enrich)} citations in parallel...")
    
    # Fetch images in parallel using ThreadPoolExecutor
    def fetch_image_for_citation(citation: Citation) -> str | None:
        """Fetch image for a single citation. Returns image_url or None."""
        return _search_image_for_citation(
            citation_title=citation.title,
            query_context=query_context,
            api_key=api_key,
            zone=zone,
            logger=logger,
            citation_url=citation.url  # Pass URL for fallback domain search
        )
    
    # Use ThreadPoolExecutor with max_workers based on number of citations
    # Cap at 5 workers to avoid overwhelming the API
    max_workers = min(len(citations_to_enrich), 5)
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all image fetch tasks
        future_to_citation = {
            executor.submit(fetch_image_for_citation, citation): citation
            for citation in citations_to_enrich
        }
        
        # Process results as they complete
        for future in as_completed(future_to_citation):
            citation = future_to_citation[future]
            try:
                image_url = future.result()
                if image_url:
                    citation.image = image_url
                    enriched_count += 1
                    logger.emit("enrich_images", "info", f"Found image for citation {citation.id}: {image_url[:50]}...")
                else:
                    logger.emit("enrich_images", "debug", f"No image found for citation {citation.id}: {citation.title[:50]}")
            except Exception as e:
                logger.emit("enrich_images", "error", f"Error fetching image for citation {citation.id}: {str(e)[:100]}")
    
    logger.emit("enrich_images", "info", f"Enriched {enriched_count}/{len(citations)} citations with images")
    
    logger.end("enrich_images")
    return state
