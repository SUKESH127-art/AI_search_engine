# Troubleshooting Guide

## Backend Not Running Error

If you see "Failed to connect to backend server at http://localhost:8000", it means the backend isn't running.

### Quick Fix: Use the Integrated Startup Script

The easiest way to start both servers is:

```bash
cd frontend
npm run dev
```

This will:
1. Start the backend server first
2. Wait for it to be ready
3. Start the frontend server

### Manual Backend Startup

If you prefer to start the backend manually:

**Option 1: Using the npm script**
```bash
cd frontend
npm run dev:backend
```

**Option 2: Direct command (from project root)**
```bash
cd ..  # Go to project root (fleetline_take_home)
source backend/venv/bin/activate  # On Windows: backend\venv\Scripts\activate
uvicorn backend.app.api.main:app --reload --port 8000
```

**Option 3: Without virtual environment**
```bash
cd ..  # Go to project root (fleetline_take_home)
python3 -m uvicorn backend.app.api.main:app --reload --port 8000
```

### Verify Backend is Running

Open in your browser or use curl:
```bash
curl http://localhost:8000/health
```

You should see: `{"status":"ok"}`

### Common Issues

#### 1. Python not found
**Error:** `python3: command not found`

**Solution:**
- Install Python 3.8+ from [python.org](https://www.python.org/downloads/)
- Or use Homebrew: `brew install python3`

#### 2. uvicorn not installed
**Error:** `No module named 'uvicorn'`

**Solution:**
```bash
cd backend
pip install -r requirements.txt
```

Or if using virtual environment:
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

#### 3. Module not found errors
**Error:** `ModuleNotFoundError: No module named 'backend'`

**Solution:**
The backend uses absolute imports (`from backend.app...`), so you must run from the **project root**, not the backend directory:
```bash
# From project root (fleetline_take_home)
cd ..  # If you're in frontend or backend directory
python3 -m uvicorn backend.app.api.main:app --reload --port 8000
```

Note: The module path is `backend.app.api.main:app`, not `app.api.main:app`

#### 4. Port already in use
**Error:** `Address already in use`

**Solution:**
- Check if something else is using port 8000:
  ```bash
  lsof -i :8000  # macOS/Linux
  netstat -ano | findstr :8000  # Windows
  ```
- Kill the process or change the port in the startup script

#### 5. Environment variables missing
**Error:** Backend starts but API calls fail

**Solution:**
- Check that you have a `.env` file in the `backend` directory
- Required variables are listed in `backend/app/config.py`
- At minimum, you need:
  - `OPEN_AI_KEY` (OpenAI API key)
  - `BRIGHT_DATA_API_KEY` or `SERPAPI_API_KEY` (for web search)

### Frontend Only Startup

If you only want to start the frontend (backend running separately):

```bash
cd frontend
npm run dev:frontend
```

### Check Both Servers

**Backend:** http://localhost:8000/health
**Frontend:** http://localhost:3000

### Still Having Issues?

1. Check the terminal output for error messages
2. Verify Python version: `python3 --version` (should be 3.8+)
3. Verify Node.js version: `node --version` (should be 18+)
4. Check that all dependencies are installed:
   - Backend: `cd backend && pip list`
   - Frontend: `cd frontend && npm list`

