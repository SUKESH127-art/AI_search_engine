"""Checkpoint persistence utilities."""
import logging
import pickle
from pathlib import Path
from backend.app.agent.state import AgentState
from backend.app.config import CHECKPOINT_DIR

logger = logging.getLogger(__name__)


def _path(session_id: str) -> Path:
    """Get checkpoint file path for a session."""
    return CHECKPOINT_DIR / f"{session_id}.pkl"


def save_checkpoint(session_id: str, state: AgentState | dict) -> None:
    """
    Persist AgentState to disk.
    Accepts both AgentState objects and dicts (for LangGraph compatibility).
    """
    file_path = _path(session_id)
    try:
        # Convert AgentState to dict for consistent storage
        if isinstance(state, AgentState):
            state_to_save = state.model_dump(mode="python")
        elif isinstance(state, dict):
            state_to_save = state
        else:
            raise TypeError(f"Expected AgentState or dict, got {type(state)}")
        
        with open(file_path, "wb") as f:
            pickle.dump(state_to_save, f)
        logger.debug(f"Saved checkpoint for session: {session_id}")
    except (OSError, IOError, pickle.PicklingError) as e:
        logger.error(f"Failed to save checkpoint for session {session_id}: {e}")
        raise RuntimeError(f"Failed to save checkpoint for session {session_id}: {e}") from e


def load_checkpoint(session_id: str) -> AgentState | dict | None:
    """
    Load checkpoint if it exists, else None.
    Returns dict (for compatibility with old checkpoints) or AgentState.
    Caller should normalize to AgentState using _normalize_state if needed.
    """
    file_path = _path(session_id)
    if not file_path.exists():
        return None
    
    try:
        with open(file_path, "rb") as f:
            loaded = pickle.load(f)
            
        # Return as-is (could be dict or AgentState)
        # The caller should normalize it
        return loaded
    except (FileNotFoundError, IOError, pickle.UnpicklingError) as e:
        logger.warning(f"Failed to load checkpoint for {session_id}: {e}")
        # Return None to allow graceful degradation
        return None
    except Exception as e:
        logger.error(f"Unexpected error loading checkpoint for {session_id}: {e}", exc_info=True)
        return None

