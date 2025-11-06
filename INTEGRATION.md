# Frontend-Backend Integration Guide

## Overview

The frontend and backend have been integrated to work together. The frontend makes API calls to the backend FastAPI server to fetch search results and display them in the UI.

## Integration Components

### 1. API Service (`frontend/src/lib/api.ts`)
- **Purpose**: Handles all communication with the backend API
- **Key Functions**:
  - `askQuestion()`: Sends queries to the `/api/ask` endpoint
  - `checkHealth()`: Checks backend health status
  - `getOrCreateSessionId()`: Manages session persistence via localStorage
- **Configuration**: 
  - Default API URL: `http://localhost:8000`
  - Can be configured via `VITE_API_URL` environment variable

### 2. Search Context (`frontend/src/contexts/SearchContext.tsx`)
- **Purpose**: Manages global search state and API calls
- **Features**:
  - Loading state management
  - Search results storage
  - Session ID persistence
  - Centralized search function

### 3. Search Page (`frontend/src/pages/Search.tsx`)
- **Purpose**: Displays search results from the backend
- **Data Flow**:
  1. User enters query → URL parameter `?q=...`
  2. Component triggers `searchQuery()` from context
  3. API call made to backend `/api/ask`
  4. Results displayed in UI with:
     - Overview text and image
     - Topics (structured content)
     - Sources (with links and metadata)
     - Images tab (overview + source images)

### 4. Backend CORS Configuration
- **Location**: `backend/app/api/main.py`
- **Allowed Origins**: 
  - `http://localhost:3000` (Next.js default)
  - `http://localhost:5173` (Vite default)
  - `http://127.0.0.1:3000` and `http://127.0.0.1:5173`

## API Endpoints

### POST `/api/ask`
**Request:**
```json
{
  "session_id": "session_123",
  "query": "What is the capital of Kenya?"
}
```

**Response:**
```json
{
  "session_id": "session_123",
  "question": "What is the capital of Kenya?",
  "overview": "Nairobi is the capital...",
  "overview_image": "https://example.com/image.jpg",
  "topics": [
    {
      "title": "Geography",
      "content": "Nairobi is located..."
    }
  ],
  "sources": [
    {
      "id": 1,
      "title": "Article Title",
      "url": "https://example.com/article",
      "image": "https://example.com/img.jpg",
      "extended_snippet": "Article snippet..."
    }
  ],
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### GET `/health`
Simple health check endpoint.

## Running the Application

### Quick Start (Recommended)
Run both backend and frontend with a single command:
```bash
cd frontend
npm install
npm run dev
```

This will:
1. Start the backend server first (on port 8000)
2. Wait for the backend to be ready (checks health endpoint)
3. Start the frontend server (on port 3000)
4. Both servers will run concurrently

**Note:** If you see "Failed to connect to backend server", make sure:
- Python is installed and accessible
- Backend dependencies are installed: `cd backend && pip install -r requirements.txt`
- Required environment variables are set (see Configuration section)

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for more help.

### Manual Start (Alternative)

**Backend only:**
```bash
# From project root (fleetline_take_home)
cd ..  # If you're in frontend directory
source backend/venv/bin/activate  # or `backend\venv\Scripts\activate` on Windows
uvicorn backend.app.api.main:app --reload --port 8000
```

**Frontend only:**
```bash
cd frontend
npm install
npm run dev:frontend
```

**Backend only (from frontend directory):**
```bash
cd frontend
npm run dev:backend
```

## Configuration

### Environment Variables

**Frontend** (optional):
- `NEXT_PUBLIC_API_URL`: Backend API URL (default: `http://localhost:8000`)
  
  Create a `.env.local` file in the `frontend` directory:
  ```
  NEXT_PUBLIC_API_URL=http://localhost:8000
  ```

**Backend** (required):
- See `backend/app/config.py` for required environment variables

## Session Management

- Session IDs are automatically generated and stored in browser localStorage
- Sessions persist across page refreshes
- Each session maintains conversation history in the backend via checkpoints

## Data Flow

1. **User Query** → Search page receives query from URL
2. **API Call** → `searchQuery()` called with session_id and query
3. **Backend Processing** → LangGraph agent processes query through:
   - Search node (web search)
   - Prioritize node (filter results)
   - Enrich images node (fetch images)
   - Synthesize node (generate answer)
   - Format output node (structure response)
4. **Response** → Backend returns structured JSON
5. **UI Update** → Frontend displays results in tabs:
   - **Findings**: Overview + Topics
   - **Images**: Overview image + Source images
   - **Sources**: List of cited sources with links
   - **Steps**: Search process steps
   - **Similar**: Related topics (clickable to search)

## Error Handling

- API errors are caught and displayed via toast notifications
- Failed image loads are handled gracefully (hidden on error)
- Invalid URLs in sources are handled with fallback display
- Loading states are managed throughout the search process

## Testing the Integration

1. Start the backend server
2. Start the frontend dev server
3. Navigate to the homepage
4. Enter a search query
5. Verify:
   - Loading animation appears
   - Results display correctly
   - All tabs show appropriate data
   - Sources are clickable
   - Images load (if available)

