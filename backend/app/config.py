"""Application configuration module.

Centralizes environment variables and configuration constants.
All environment variables should be loaded through this module.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from backend directory
_env_path = Path(__file__).parent.parent / ".env"
load_dotenv(_env_path)


# API Keys
# Note: Environment variable is OPEN_AI_KEY but we export as OPENAI_API_KEY for consistency
_OPEN_AI_KEY = os.getenv("OPEN_AI_KEY")
OPENAI_API_KEY = _OPEN_AI_KEY  # Export with consistent naming
BRIGHT_DATA_API_KEY = os.getenv("BRIGHT_DATA_API_KEY")
SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY")
SERP_ZONE = os.getenv("SERP_ZONE")

# API Configuration
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_TEMPERATURE = float(os.getenv("OPENAI_TEMPERATURE", "0.3"))

# HTTP Configuration
HTTP_TIMEOUT_SEARCH = int(os.getenv("HTTP_TIMEOUT_SEARCH", "30"))  # Keep at 30s for SERP API
HTTP_TIMEOUT_IMAGE = int(os.getenv("HTTP_TIMEOUT_IMAGE", "3"))  # Reduced to 3s for faster failure
HTTP_USER_AGENT = os.getenv("HTTP_USER_AGENT", "FleetlineAgent/1.0")

# Image Enrichment Configuration
HTML_MAX_SIZE = int(os.getenv("HTML_MAX_SIZE", "50000"))  # 50KB
HTML_CHUNK_SIZE = int(os.getenv("HTML_CHUNK_SIZE", "8192"))  # 8KB chunks

# Prioritization Configuration
PRIORITIZE_MAX_RESULTS = int(os.getenv("PRIORITIZE_MAX_RESULTS", "5"))

# Data Directories
DATA_DIR = Path(__file__).parent.parent.parent / "data"
CHECKPOINT_DIR = DATA_DIR / "checkpoints"
LOG_DIR = DATA_DIR / "logs"

# Ensure data directories exist
os.makedirs(CHECKPOINT_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)

