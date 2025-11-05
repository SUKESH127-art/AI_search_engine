# Perplexity MVP — System Design & Implementation Plan

## 0) Goals (MVP)

* Natural-language Q&A with **live search**, **credible source prioritization**, **concise synthesis**, and **inline citations** (with preview images).
* **Conversational continuity** using **LangGraph checkpoints** (no external DB yet).
* **One simple API** (`POST /api/ask`) + **progress polling** (`GET /api/progress/{session_id}`).
* **Clear logs** that the frontend can show as “Searching… Synthesizing…”.

---

## 1) Architecture Overview

```mermaid
flowchart LR
  FE[Next.js] -->|POST /api/ask| API(FastAPI)
  API --> LG[LangGraph Agent]
  LG --> S[search]
  S --> P[prioritize_sources]
  P --> Y[synthesize]
  Y --> I[enrich_images]
  I --> F[format_output]
  LG --> CK[(Checkpoints per session)]
  LG --> LOG[[JSONL Progress Logs]]
  FE <-->|GET /api/progress/{session_id}| LOG
```

**Why this shape?**

* Linear nodes are easiest to debug and test.
* Checkpoints give us conversational memory with minimal code.
* JSONL logs enable a great UI without websockets (yet).

---

## 2) LangGraph: Nodes & Contracts

### 2.1 Node list (in order)

1. `search` → call SERP, return top results (title/url/snippet/domain).
2. `prioritize_sources` → LLM ranks domains for the topic (gov for policy, Billboard/Genius for music, etc.).
3. `synthesize` → LLM produces concise answer with inline citations `[1]`, `[2]` and a JSON list of citations.
4. `enrich_images` → scrape OpenGraph `og:image` (fallback: first `<img>`).
5. `format_output` → normalize the final JSON for the API.

### 2.2 AgentState (Pydantic)

```python
class SearchResult(BaseModel):
    title: str
    url: str
    snippet: str
    domain: str

class Citation(BaseModel):
    id: int
    title: str
    url: str
    image: str | None = None

class AgentState(BaseModel):
    session_id: str
    query: str
    history: list[dict] = []                # checkpoints memory (last runs)
    results: list[SearchResult] | None = None
    ranked_results: list[SearchResult] | None = None
    answer: str | None = None
    citations: list[Citation] | None = None
    final_payload: dict | None = None
```

### 2.3 Graph wiring

```python
graph = StateGraph(AgentState)
for name, fn in [
  ("search", search),
  ("prioritize_sources", prioritize_sources),
  ("synthesize", synthesize),
  ("enrich_images", enrich_images),
  ("format_output", format_output),
]: graph.add_node(name, fn)

graph.set_entry_point("search")
graph.add_edge("search", "prioritize_sources")
graph.add_edge("prioritize_sources", "synthesize")
graph.add_edge("synthesize", "enrich_images")
graph.add_edge("enrich_images", "format_output")
graph.add_edge("format_output", END)

agent = graph.compile()
```

---

## 3) Memory: LangGraph Checkpoints (no DB yet)

* **On request start**: load last checkpoint by `session_id` → gives prior `state.history`.
* Append new `{"role":"user","content": query}`.
* **On completion**: append `{"role":"assistant","content": answer}` and save checkpoint.

```python
state = load_checkpoint(session_id) or AgentState(session_id=session_id, history=[], query=req.query)
state.history.append({"role": "user", "content": req.query})
final = agent.invoke(state)
final.history.append({"role": "assistant", "content": final.answer})
save_checkpoint(session_id, final)
```

*Storage*: `data/checkpoints/{session_id}.pkl` (simple pickle). Swap later to LangGraph’s SQL store if needed.

---

## 4) Logging: User-Visible Progress

* **Per session** JSONL file: `data/logs/{session_id}.jsonl`.
* Each node emits `start|end|error`.
* Frontend polls `GET /api/progress/{session_id}` every 1s.

```python
# agent/logging.py
class AgentLogger:
    def start(self, step): ...
    def end(self, step): ...
    def error(self, step, message): ...
```

*Node pattern:*

```python
log.start("search")
# do work...
log.end("search")
```

*API:*

```python
@app.get("/api/progress/{session_id}")
def progress(session_id: str):
    path = f"data/logs/{session_id}.jsonl"
    return {"events": [json.loads(l) for l in open(path).read().splitlines()] if os.path.exists(path) else []}
```

Frontend shows:

* search.start → “Searching sources…”
* prioritize_sources.start → “Evaluating credibility…”
* synthesize.start → “Synthesizing answer…”
* enrich_images.start → “Adding visuals…”
* format_output.end → “Answer ready.”

---

## 5) Core Logic Details

### 5.1 Search (SERP API)

* Limit to 8–10 results.
* Extract `domain = urlparse(url).netloc`.

### 5.2 Source Prioritization (LLM)

* Small, cheap model (`gpt-4o-mini` class).
* Prompt seeds with topic rules:

```
You assess domain credibility for a query.
Prefer:
- Government/regulatory (.gov, who.int) for policy, health, safety.
- Primary sources and recognized authorities (e.g., travel.state.gov, cdc.gov).
- For music rankings: billboard.com, genius.com, pitchfork.com.
- For tech docs: vendor docs, standards bodies (ietf.org, w3.org).
Return JSON: [{"url":..., "rank":1, "reason":"..."}, ...] for top 5.
```

* Reorder results by this ranking; keep titles/snippets unchanged.

### 5.3 Synthesis (LLM)

* Input: last ~5 history turns + top 5 ranked sources (ID-indexed).
* Low temp (≤ 0.3).
* Output JSON:

```json
{
  "answer": "…with [1][2] inline…",
  "citations": [{"id":1,"title":"...","url":"..."}]
}
```

### 5.4 Image Enrichment

* Fetch `og:image` with a short timeout; if absent, first `<img>` with absolute URL.
* Cache map `{url → image_url}` in memory/dict for the run (optional to persist later).

### 5.5 Format Output

Final payload:

```json
{
  "question": "<query>",
  "answer": "<final text with inline [1][2]>",
  "sources": [{"title":"...","url":"...","image":"..."}],
  "timestamp": "<UTC ISO>",
  "latency_ms": 0
}
```

---

## 6) FastAPI: Endpoints & Models

### 6.1 Models

```python
class AskRequest(BaseModel):
    session_id: str | None = None
    query: str

class AskResponse(BaseModel):
    session_id: str
    answer: str
    sources: list[Citation]
    timestamp: str
    latency_ms: int
```

### 6.2 Routes

* `POST /api/ask` → runs full graph; returns final answer + citations.
* `GET /api/progress/{session_id}` → returns JSONL events.
* `GET /health` → simple “ok”.

Synchronous pattern (MVP). Streaming can be added later.

---

## 7) Repo Layout

```
/app
  /agent
    __init__.py
    state.py
    graph.py
    nodes/
      search.py
      prioritize.py
      synthesize.py
      enrich_images.py
      format_output.py
    checkpoints.py
    logging.py
    prompts.py
  /api
    main.py
  /docs
    agent.md
    system-design.md   <-- this file
/data
  /checkpoints
  /logs
requirements.txt
.env.example
```

---

## 8) Config & Keys

* `SERP_API_KEY`, `OPENAI_API_KEY` from `.env`.
* Timeouts: SERP 6s; image fetch 3s.
* Hard caps: max 5 sources into synthesis; max 5 history messages.

---

## 9) Security & Reliability (MVP-level)

* **Input sanitation**: clamp query length (e.g., 1–1,000 chars).
* **Outbound allowlist**? Not required now; we only hit SERP + source URLs for OG images.
* **Rate limiting**: simple per-IP (e.g., `slowapi`) if public.
* **Error handling**: if `prioritize_sources` fails, fall back to raw search order; if `enrich_images` fails for a URL, skip image.

---

## 10) Local Dev & Runbook

**Install**

```
pip install -r requirements.txt
uvicorn api.main:app --reload
```

**Smoke test**

```
curl -X POST http://localhost:8000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"query":"What are current US passport renewal requirements?", "session_id":"demo"}'
```

**Progress**

```
curl http://localhost:8000/api/progress/demo
```

---

## 11) Testing Plan (MVP)

* **Unit**:

  * `search` returns ≤10 results; each has title/url/snippet/domain.
  * `prioritize_sources` preserves all inputs and returns ranked subset ≤5.
  * `synthesize` returns JSON with `answer` & ≥1 citation.
* **Integration**:

  * `/api/ask` returns 200 with nonempty `answer` & `sources`.
  * Progress endpoint shows ordered start/end pairs for nodes.
* **Resilience**:

  * Force SERP failure → ensure graceful message + empty results path.
  * Force image timeout → still returns answer.

---

## 12) Ready-Now Enhancements (non-blocking)

* **Source de-duplication** by domain (keep highest-ranked per domain).
* **LLM function-calling** schema to hard-validate `synthesize` JSON.
* **Minimal cache**: hash(query) → prior final payload for 10 minutes.

---