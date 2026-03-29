# NexusAI — Architecture

## What is it?

One API endpoint. You send a prompt, NexusAI picks the best free AI provider, returns the response. If one provider fails, it tries the next. Responses are cached so repeated prompts are instant.

---

## Big Picture

```
Your App / Postman / Browser
           |
           | POST /ask  { "prompt": "..." }
           ↓
    ┌─────────────────┐
    │   NexusAI API   │  (Render.com)
    │   Express.js    │
    └────────┬────────┘
             |
    ┌────────▼────────┐
    │  Redis Cache    │  ← Check cache first (Upstash)
    └────────┬────────┘
             |
    ┌────────▼────────┐
    │  Smart Router   │  ← Pick best available provider
    └────────┬────────┘
             |
    ┌────────▼──────────────────────────────────┐
    │  Providers (tried in priority order)       │
    │  1. Gemini  2. Groq  3. Cloudflare        │
    │  4. HuggingFace  5. Cohere                │
    │  6. OpenRouter  7. Ollama (self-hosted)    │
    └────────┬──────────────────────────────────┘
             |
    ┌────────▼────────┐
    │  SQLite DB      │  ← Log every request
    └─────────────────┘
             |
           Response → back to you
```

---

## Layers Explained

| Layer | File(s) | Job |
|-------|---------|-----|
| **Entry** | `server/index.js` | Start server, connect DB + Redis, register routes |
| **Auth** | `server/middleware/auth.js` | Check `x-api-key` header |
| **Rate Limit** | `server/middleware/rateLimit.js` | Max 30 req/min per IP |
| **Cache** | `server/services/cache.js` | Redis get/set — skip AI call if cached |
| **Dedup** | `server/services/deduplicator.js` | Same prompt sent twice at once → one API call |
| **Router** | `server/services/router.js` | Pick healthy provider, handle fallback |
| **Providers** | `server/providers/*.js` | Each provider's API call logic |
| **Logger** | `server/services/logger.js` | Save request to SQLite |
| **Admin API** | `server/routes/admin.js` | Admin panel data endpoints |
| **Admin UI** | `admin/index.html` | Single HTML file, no build step |

---

## Full Request → Response Cycle

**Example:** `POST /ask` with `{ "prompt": "What is JavaScript?" }`

```
Step 1 — RATE LIMIT CHECK
  Is this IP sending > 30 req/min?
  → YES: return 429 Too Many Requests
  → NO: continue

Step 2 — AUTH CHECK
  Is x-api-key header valid?
  → NO key configured in .env = open access (dev mode)
  → Invalid key = return 401 Unauthorized
  → Valid = continue

Step 3 — NORMALIZE PROMPT
  "What is JavaScript?"
  → lowercase, remove punctuation, remove filler words (what, is)
  → sorted: "javascript"
  → SHA-256 hash → cache key: "ai:abc123..."

Step 4 — CACHE CHECK (Redis)
  Does key "ai:abc123..." exist in Redis?
  → HIT: return cached response immediately (0ms AI call)
  → MISS: continue

Step 5 — DEDUPLICATION
  Is the same prompt already being processed right now?
  → YES: wait for that request, return same result (no duplicate API call)
  → NO: proceed

Step 6 — SMART ROUTING
  Get providers in priority order: [gemini, groq, cloudflare, ...]
  For each provider:
    - Is it enabled?          → skip if disabled
    - Is it healthy?          → skip if 3+ recent failures (5 min cooldown)
    - Has quota remaining?    → skip if daily limit hit
    - Try provider.ask(prompt)
      → SUCCESS: mark healthy, use this response
      → FAIL: mark failure, try next provider

Step 7 — CACHE STORE (Redis)
  Store response with TTL:
  - "what is..." → factual → 7 days TTL
  - "today's news" → time-sensitive → 1 hour TTL
  - anything else → default → 1 day TTL

Step 8 — LOG TO SQLITE
  Save: request_id, prompt, provider used, latency, success/fail

Step 9 — RETURN RESPONSE
  {
    "success": true,
    "response": "JavaScript is a programming language...",
    "provider": "groq",
    "cached": false,
    "latency_ms": 634,
    "request_id": "req_a1b2c3d4e5f6"
  }
```

---

## Provider Health Tracking

```
Provider fails → failures++
failures >= 3  → marked UNHEALTHY for 5 minutes
After 5 min    → auto-recover, failures reset to 0
Success call   → failures reset to 0 immediately
```

Health state is in-memory (resets on server restart). Controlled by:
- `HEALTH_COOLDOWN_MINUTES` env var (default 5)
- Failure threshold: hardcoded as 3 in `server/services/router.js:31`

---

## Cache Key Logic

```
"Please can you tell me what is JavaScript?"
        ↓  normalize()
Remove: please, can, you, tell, me, what, is  (filler words)
Keep:   javascript
Sort:   javascript
Hash:   sha256("javascript") → "ai:b94f6..."
```

Two different phrasings of the same question → same cache key → one stored answer.

---

## Data Flow Diagram

```
POST /ask
  │
  ├─[rate limit]──────────────────────→ 429
  │
  ├─[auth]────────────────────────────→ 401
  │
  ├─[cache HIT]───────────────────────→ 200 (cached: true)
  │
  ├─[dedup: already in-flight]────────→ 200 (shared result)
  │
  ├─[route: provider 1 OK]────────────→ 200 (provider: gemini)
  │
  ├─[route: provider 1 fail → try 2]──→ 200 (provider: groq)
  │
  └─[all providers fail]──────────────→ 503
```

---

## Admin Panel

Deployed separately on Vercel. Talks to the backend via fetch calls.

```
admin/index.html          →  Single page, 7 views
admin/utils/api.js        →  fetch() wrappers for all admin endpoints

Admin endpoints (all need x-admin-password header):
  GET  /admin/stats              Dashboard numbers
  GET  /admin/providers          Provider list + quota + health
  PUT  /admin/providers/:name    Toggle enable/disable
  PUT  /admin/providers-priority Reorder priority
  GET  /admin/logs               Request logs (filterable)
  GET  /admin/logs/export        Download CSV
  GET  /admin/cache/stats        Redis key count
  DELETE /admin/cache            Flush Redis
  GET  /admin/settings           Current config
  POST /admin/playground         Test a prompt
```

---

## Database Tables (SQLite)

```
request_logs
  id, request_id, timestamp, prompt, provider_used,
  cached, latency_ms, success, error_message, client_ip

provider_stats
  provider, date, requests_made, requests_failed,
  avg_latency_ms, cache_hits

settings
  key, value   ← stores provider_priority + provider_enabled JSON
```

---

## Tech Stack Summary

| What | Tech | Why |
|------|------|-----|
| Server | Node.js + Express | Simple, fast |
| Database | SQLite (better-sqlite3) | Zero setup, file-based |
| Cache | Upstash Redis | Free tier, serverless |
| Frontend | HTML + Tailwind CDN | No build step needed |
| Backend hosting | Render.com | Free tier, auto-deploy from GitHub |
| Frontend hosting | Vercel | Free tier, static files |
| AI Providers | 7 free APIs | $0/month total |

---

*For exact file locations and line numbers → see `CODEBASE_REFERENCE.md`*
