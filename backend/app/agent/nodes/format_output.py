"""
Node: format_output
Purpose: Produce the final structured payload returned by the API.
Creates a consistent JSON object containing the question, answer,
sources (citations), timestamp, and session metadata.
"""

from datetime import datetime, timezone
from backend.app.agent.state import AgentState
from backend.app.agent.logging import AgentLogger


def format_output(state: AgentState) -> AgentState:
    """
    Final formatting node — prepares the structured API payload.
    Ensures ISO-8601 UTC timestamps and consistent key naming.
    Also saves the assistant's answer to conversation history for context.
    """
    logger = AgentLogger()
    logger.start("format_output")

    try:
        # Generate UTC timestamp
        ts = datetime.now(timezone.utc).isoformat()

        # Get overview (preferred) or answer (fallback)
        overview = state.overview or state.answer or ""
        
        # Get topics
        topics = state.topics or []
        
        # Save assistant's full response to conversation history for future context
        if overview:
            # Build full response text for history
            full_response = overview
            if topics:
                for topic in topics:
                    full_response += f"\n\n{topic.get('title', '')}: {topic.get('content', '')}"
            state.history.append({"role": "assistant", "content": full_response})

        # Build the response payload
        payload = {
            "question": state.query,
            "overview": overview,
            "overview_image": state.overview_image,  # Single image from BrightData SERP
            "topics": topics,
            "sources": [
                c.model_dump(mode="json") for c in (state.citations or [])
            ],
            "timestamp": ts,
        }

        # Attach to state for downstream usage
        state.final_payload = payload

    except Exception as e:
        # Graceful fallback if formatting fails
        logger.error("format_output", f"Failed to build payload: {e}")
        fallback_ts = datetime.now(timezone.utc).isoformat()
        state.final_payload = {
            "question": state.query,
            "overview": state.overview or state.answer or "",
            "overview_image": state.overview_image,
            "topics": state.topics or [],
            "sources": [],
            "timestamp": fallback_ts,
        }

    logger.end("format_output")
    return state

