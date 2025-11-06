"""Synthesize node: Generate concise answer with citations from search results."""
import json
from backend.app.agent.state import AgentState, Citation
from backend.app.agent.logging import AgentLogger
from backend.app.agent.prompts import SYNTHESIZE_PROMPT
from backend.app.config import OPENAI_API_KEY, OPENAI_MODEL, OPENAI_TEMPERATURE
from openai import OpenAI


def synthesize(state: AgentState) -> AgentState:
    """
    Synthesize a concise, factual answer from search results using LLM.
    Updates state.answer and state.citations with structured output.
    """
    logger = AgentLogger()
    logger.start("synthesize")

    # Validate prerequisites - use raw search results, limit to top 5
    results = state.results or []
    # Limit to top 5 results for synthesis
    results = results[:5]
    
    if not OPENAI_API_KEY:
        logger.error("synthesize", "OPEN_AI_KEY missing.")
        state.overview = ""
        state.answer = ""
        state.topics = []
        state.citations = []
        logger.end("synthesize")
        return state
    
    if not results:
        logger.error("synthesize", "No search results.")
        state.overview = ""
        state.answer = ""
        state.topics = []
        state.citations = []
        logger.end("synthesize")
        return state

    # Build context from conversation history (use all history, no truncation)
    context_lines = []
    for m in state.history:
        role = m.get("role", "user")
        content = m.get("content", "")
        if content:
            context_lines.append(f"{role}: {content}")
    context = "\n".join(context_lines) if context_lines else ""

    # Build sources text with numbered citations, including additional context
    sources_lines = []
    for i, r in enumerate(results):
        source_info = f"[{i+1}] {r.title}"
        
        # Add snippet/description
        if r.snippet:
            source_info += f" — {r.snippet}"
        elif r.extended_snippet:
            source_info += f" — {r.extended_snippet}"
        
        # Add extended snippet if different and available
        if r.extended_snippet and r.extended_snippet != r.snippet:
            source_info += f" | Extended: {r.extended_snippet[:100]}"
        
        # Add date if available (helps with recency)
        if r.date:
            source_info += f" (Date: {r.date})"
        
        # Add keywords if available (helps with relevance)
        if r.keywords:
            keywords_str = ", ".join(r.keywords[:5])  # Limit to top 5 keywords
            source_info += f" [Keywords: {keywords_str}]"
        
        # Add breadcrumb if available (helps with context)
        if r.breadcrumb:
            source_info += f" | Location: {r.breadcrumb}"
        
        source_info += f" ({r.url})"
        sources_lines.append(source_info)
    
    sources_text = "\n".join(sources_lines)

    # Construct user message
    if context:
        user_content = f"Conversation:\n{context}\n\nQuestion: {state.query}\n\nSources:\n{sources_text}"
    else:
        user_content = f"Question: {state.query}\n\nSources:\n{sources_text}"

    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": SYNTHESIZE_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=OPENAI_TEMPERATURE,
        )

        # Extract response content
        if not resp or not resp.choices:
            logger.error("synthesize", "Empty LLM response.")
            state.overview = ""
            state.answer = ""
            state.topics = []
            state.citations = []
            logger.end("synthesize")
            return state

        content = resp.choices[0].message.content
        if not content:
            logger.error("synthesize", "Empty LLM response content.")
            state.overview = ""
            state.answer = ""
            state.topics = []
            state.citations = []
            logger.end("synthesize")
            return state

        # Parse JSON response
        data = json.loads(content)
        
        # Extract overview (new format) or answer (fallback for backward compatibility)
        overview = data.get("overview", data.get("answer", ""))
        state.overview = overview
        # For backward compatibility, also set answer to overview
        state.answer = overview
        
        # Extract topics (new field)
        topics = data.get("topics", [])
        if isinstance(topics, list):
            # Validate topics structure
            validated_topics = []
            for topic in topics:
                if isinstance(topic, dict) and "title" in topic and "content" in topic:
                    validated_topics.append({
                        "title": str(topic.get("title", "")),
                        "content": str(topic.get("content", ""))
                    })
            state.topics = validated_topics[:2]  # Limit to 2 topics
        else:
            state.topics = []
        
        # Parse citations
        cits = data.get("citations", [])
        if not isinstance(cits, list):
            cits = []

        # Create URL-to-SearchResult mapping to get extended_snippet
        url_to_result = {}
        if state.results:
            for r in state.results:
                url_to_result[r.url] = r

        # Build Citation models safely, including extended_snippet from search results
        citations = []
        for c in cits:
            if not isinstance(c, dict):
                continue
            try:
                cid = c.get("id")
                if cid is None:
                    continue
                citation_url = c.get("url", "")
                
                # Find matching SearchResult to get extended_snippet
                matching_result = url_to_result.get(citation_url)
                extended_snippet = None
                
                if matching_result:
                    # Directly access extended_snippet attribute
                    try:
                        extended_snippet = matching_result.extended_snippet
                        if extended_snippet:
                            logger.emit("synthesize", "debug", f"Found extended_snippet for {citation_url[:50]}: {len(extended_snippet)} chars")
                        else:
                            logger.emit("synthesize", "debug", f"Match found but extended_snippet is None for {citation_url[:50]}")
                    except AttributeError:
                        logger.emit("synthesize", "warning", f"Match found but no extended_snippet attr for {citation_url[:50]}")
                else:
                    logger.emit("synthesize", "debug", f"No URL match for citation: {citation_url[:50]}")
                
                # Create Citation with extended_snippet
                try:
                    citation = Citation(
                        id=int(cid),
                        title=c.get("title", ""),
                        url=citation_url,
                        extended_snippet=extended_snippet
                    )
                    # Verify extended_snippet was set
                    if citation.extended_snippet != extended_snippet:
                        logger.emit("synthesize", "error", f"Citation extended_snippet mismatch! Expected: {extended_snippet is not None}, Got: {citation.extended_snippet is not None}")
                    citations.append(citation)
                except Exception as e:
                    logger.emit("synthesize", "error", f"Failed to create Citation: {e}")
                    # Continue with next citation
                    continue
            except (ValueError, TypeError, KeyError):
                continue

        # Limit total citations to top 5 to keep payload concise
        state.citations = citations[:5]

    except json.JSONDecodeError as e:
        logger.error("synthesize", f"Invalid JSON from LLM: {e}")
        state.overview = ""
        state.answer = ""
        state.topics = []
        state.citations = []
    except Exception as e:
        logger.error("synthesize", f"LLM API error: {e}")
        state.overview = ""
        state.answer = ""
        state.topics = []
        state.citations = []

    logger.end("synthesize")
    return state

