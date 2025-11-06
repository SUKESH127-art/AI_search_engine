"""FastAPI application entry point."""
import logging
import uuid
from typing import Any
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ValidationError
from backend.app.agent.state import AgentState
from backend.app.agent.graph import build_graph

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Fleetline Agent API", version="1.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:3001", "http://127.0.0.1:5173"],  # Common frontend dev ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize graph with error handling
try:
    graph = build_graph()
    logger.info("LangGraph compiled successfully")
except Exception as e:
    logger.error(f"Failed to build graph: {e}", exc_info=True)
    raise


def _normalize_state(state: dict | AgentState) -> AgentState:
    """
    Convert dict or AgentState to AgentState object.
    Handles both LangGraph dict returns and AgentState objects.
    """
    if isinstance(state, AgentState):
        return state
    elif isinstance(state, dict):
        try:
            return AgentState(**state)
        except (ValidationError, TypeError) as e:
            logger.error(f"Failed to normalize state dict: {e}")
            logger.debug(f"State dict keys: {list(state.keys()) if state else 'None'}")
            raise ValueError(f"Invalid state format: {e}") from e
    else:
        raise TypeError(f"Expected dict or AgentState, got {type(state)}")


@app.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "ok"}


class RelatedQuestionsResponse(BaseModel):
    questions: list[str]


class AskRequest(BaseModel):
    query: str


class AskResponse(BaseModel):
    question: str
    overview: str  # Main comprehensive answer
    overview_image: str | None = None  # Single image from BrightData SERP for the overview
    topics: list[dict[str, str]]  # List of {"title": "...", "content": "..."}
    sources: list[dict]
    timestamp: str


@app.post("/api/ask", response_model=AskResponse)
async def ask(request: AskRequest):
    """
    Main endpoint for querying the agent.
    Processes query through the full LangGraph pipeline and returns structured response.
    """
    query = request.query.strip()
    
    if not query:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Query must not be empty"
        )

    request_id = f"request_{uuid.uuid4().hex}"

    try:
        state = AgentState(
            query=query,
            history=[{"role": "user", "content": query}]
        )
        logger.info(f"Processing new request {request_id} for query: {query[:50]}...")

        # Run LangGraph with error handling
        # LangGraph accepts both AgentState and dict, but returns dict
        try:
            # Convert AgentState to dict for LangGraph (it accepts both but returns dict)
            state_dict = state.model_dump(mode="python") if isinstance(state, AgentState) else state
            result = graph.invoke(state_dict)
            logger.info(f"Graph execution completed for request: {request_id}")
        except Exception as e:
            logger.error(f"Graph execution failed for request {request_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Agent execution failed: {str(e)}"
            ) from e

        # Normalize result (LangGraph returns dict)
        try:
            if isinstance(result, dict):
                result_state = _normalize_state(result)
            elif isinstance(result, AgentState):
                result_state = result
            else:
                raise TypeError(f"Unexpected result type: {type(result)}")
        except (ValueError, TypeError, ValidationError) as e:
            logger.error(f"Failed to normalize graph result: {e}", exc_info=True)
            logger.debug(f"Result type: {type(result)}, keys: {list(result.keys()) if isinstance(result, dict) else 'N/A'}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Agent returned invalid state format"
            ) from e

        # Extract payload
        payload = result_state.final_payload if hasattr(result_state, 'final_payload') else None
        
        if not payload:
            logger.warning(f"No final_payload in result for request: {request_id}")
            # Try to build a minimal payload from state
            from datetime import datetime, timezone
            overview = getattr(result_state, 'overview', None) or getattr(result_state, 'answer', None) or ""
            topics = getattr(result_state, 'topics', None) or []
            payload = {
                "question": result_state.query if hasattr(result_state, 'query') else query,
                "overview": overview,
                "overview_image": getattr(result_state, 'overview_image', None),
                "topics": topics,
                "sources": [
                    c.model_dump(mode="json") if hasattr(c, 'model_dump') else c
                    for c in (result_state.citations or [])
                ] if hasattr(result_state, 'citations') and result_state.citations else [],
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            logger.info(f"Built fallback payload for request: {request_id}")

        # Validate payload structure
        if not isinstance(payload, dict):
            logger.error(f"Payload is not a dict: {type(payload)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Agent returned invalid payload format"
            )

        # Ensure required fields exist (updated for new format)
        required_fields = ["question", "overview", "topics", "sources", "timestamp"]
        missing_fields = [f for f in required_fields if f not in payload]
        
        # Handle backward compatibility: if "answer" exists but "overview" doesn't, migrate it
        if "answer" in payload and "overview" not in payload:
            payload["overview"] = payload["answer"]
        if "topics" not in payload:
            payload["topics"] = []
        if missing_fields:
            logger.error(f"Payload missing required fields: {missing_fields}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Agent payload missing required fields: {missing_fields}"
            )

        logger.info(f"Successfully processed request: {request_id}")
        return payload

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Catch-all for unexpected errors
        logger.error(f"Unexpected error processing request {request_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        ) from e


@app.get("/api/related-questions", response_model=RelatedQuestionsResponse)
async def related_questions(query: str):
    """
    Generate related questions based on the query using LLM.
    Returns a list of related question strings.
    
    Args:
        query: The search query to generate related questions for
    """
    query = query.strip()
    
    if not query:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Query must not be empty"
        )
    
    try:
        from backend.app.config import OPENAI_API_KEY, OPENAI_MODEL, OPENAI_TEMPERATURE
        from openai import OpenAI
        
        # Note: config.py uses OPEN_AI_KEY env var, but exports as OPENAI_API_KEY
        if not OPENAI_API_KEY:
            logger.warning("OPENAI_API_KEY not found, returning empty related questions")
            return RelatedQuestionsResponse(questions=[])
        
        client = OpenAI(api_key=OPENAI_API_KEY)
        
        prompt = f"""Given the following query, generate 3-5 related questions that users might also be interested in.
The questions should be:
- Directly related to the original query
- Diverse in perspective (different angles on the topic)
- Clear and concise
- Questions that would lead to useful search results

Original query: {query}

Return ONLY a JSON array of question strings, no other text:
["question 1", "question 2", "question 3", ...]"""
        
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are a helpful assistant that generates related search questions. Always return valid JSON arrays."},
                {"role": "user", "content": prompt},
            ],
            temperature=OPENAI_TEMPERATURE + 0.2,  # Slightly higher temperature for variety
            max_tokens=200,
        )
        
        if not resp or not resp.choices or not resp.choices[0].message.content:
            logger.warning("Empty LLM response for related questions")
            return RelatedQuestionsResponse(questions=[])
        
        content = resp.choices[0].message.content.strip()
        
        # Parse JSON response
        import json
        try:
            # Try to extract JSON array from response (in case LLM adds extra text)
            if content.startswith('[') and content.endswith(']'):
                questions = json.loads(content)
            elif '[' in content and ']' in content:
                # Extract JSON array from response
                start = content.index('[')
                end = content.rindex(']') + 1
                questions = json.loads(content[start:end])
            else:
                # Fallback: try parsing as is
                questions = json.loads(content)
            
            # Validate and clean questions
            if not isinstance(questions, list):
                questions = []
            
            # Filter out empty strings and limit to 5
            questions = [q.strip() for q in questions if isinstance(q, str) and q.strip()][:5]
            
            logger.info(f"Generated {len(questions)} related questions for query: {query[:50]}")
            return RelatedQuestionsResponse(questions=questions)
            
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse related questions JSON: {e}, content: {content[:100]}")
            return RelatedQuestionsResponse(questions=[])
            
    except Exception as e:
        logger.error(f"Error generating related questions: {e}", exc_info=True)
        # Return empty list instead of failing
        return RelatedQuestionsResponse(questions=[])
