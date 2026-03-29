# NexusAI — Full Project Context

> Give this file to any Claude agent to instantly understand the entire project.

---

## What is NexusAI?

NexusAI is a **personal AI API gateway** built for free. Instead of calling Gemini/Groq/HuggingFace directly from each app, every app calls **one endpoint** `/ask` with a secret key. The server routes to free AI providers automatically with fallback, caching, and deduplication.

**Total cost: $0**

---

## Location

```
C:\Users\Dhruv Tilva\Desktop\nexus-ai\
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js + Express |
| Database | SQLite (better-sqlite3) |
| Cache | Upstash Redis (free tier) |
| Frontend | Plain HTML + Tailwind CDN + Vanilla JS |
| Hosting | Render.com (backend) + Vercel (admin) |

---

## Full Project Structure

```
nexus-ai/
├── README.md
├── .gitignore
├── server/
│   ├── index.js                    # Express entry point, starts on port 3000
│   ├── package.json                # deps: express, better-sqlite3, @upstash/redis, uuid, node-fetch, express-rate-limit
│   ├── .env.example                # All environment variables template
│   ├── nexusai.db                  # SQLite DB (auto-created on first run)
│   ├── config/
│   │   └── providers.js            # Loads all 7 providers, manages priority order, persists enabled/priority to SQLite
│   ├── db/
│   │   └── sqlite.js               # initDB() creates tables: request_logs, provider_stats, settings
│   ├── middleware/
│   │   ├── auth.js                 # apiKeyAuth (x-api-key header), adminAuth (x-admin-password header)
│   │   ├── cors.js                 # CORS — allows all origins
│   │   └── rateLimit.js            # askLimiter (30/min), adminLimiter (60/min)
│   ├── providers/                  # All 7 providers follow same interface
│   │   ├── gemini.js               # Google Gemini 2.0 Flash — 1500/day free
│   │   ├── groq.js                 # Groq llama-3.1-8b-instant — 14400/day free
│   │   ├── huggingface.js          # HuggingFace Mistral-7B — ~1000/day free
│   │   ├── cohere.js               # Cohere command-r — ~1000/month free
│   │   ├── cloudflare.js           # Cloudflare Workers AI llama-3.1-8b — 10000 neurons/day free
│   │   ├── openrouter.js           # OpenRouter free models (meta-llama/llama-3.1-8b-instruct:free)
│   │   └── ollama.js               # Ollama self-hosted (phi3:mini) — unlimited fallback
│   ├── routes/
│   │   ├── ask.js                  # POST /ask — main endpoint
│   │   ├── admin.js                # All /admin/* routes (protected by adminAuth)
│   │   └── health.js               # GET /health, GET /providers
│   └── services/
│       ├── router.js               # Smart routing: priority order → health check → fallback
│       ├── cache.js                # Upstash Redis get/set/clear with prompt hash as key
│       ├── normalizer.js           # normalize(prompt), hashPrompt(prompt), getTTL(prompt)
│       ├── deduplicator.js         # In-memory Map — identical requests share one API call
│       └── logger.js               # logRequest(), getLogs(), getStats(), exportLogsCSV()
├── admin/
│   ├── index.html                  # Single file — all 5 pages in one HTML (Dashboard, Providers, Logs, Playground, Settings)
│   └── utils/
│       └── api.js                  # adminAPI client — all fetch calls to /admin/* endpoints
└── docs/
    ├── SETUP.md                    # How to get all free API keys + run locally
    ├── API_DOCS.md                 # /ask endpoint reference + code examples (JS, Python, cURL)
    └── DEPLOYMENT.md               # Deploy on Render + Vercel + Upstash (all free)
```

---

## Provider Interface (all 7 providers follow this)

```javascript
module.exports = {
  name: 'gemini',           // internal name
  displayName: 'Google Gemini',
  isEnabled: true,
  dailyLimit: 1500,
  requestsToday: 0,
  lastResetDate: new Date().toDateString(),

  async ask(prompt, options = {}) { /* calls API, returns plain text string */ },
  async checkHealth() { /* returns true/false */ },
  getQuotaRemaining() { /* returns dailyLimit - requestsToday */ },
  _resetIfNewDay() { /* resets counter if date changed */ },
}
```

---

## /ask Request Flow

```
POST /ask
  → askLimiter (rate limit: 30/min per IP)
  → apiKeyAuth (checks x-api-key header against ALLOWED_API_KEYS env)
  → check Redis cache (key = "ai:" + sha256(normalized prompt))
    → if HIT: return cached response, log with provider="cache"
  → deduplicate (if same prompt already in-flight, wait for same result)
  → router.route(prompt, options)
      → loop through priorityOrder providers
      → skip: disabled, unhealthy, quota=0
      → try provider.ask() with timeout
      → on success: markSuccess, return result
      → on fail: markFailure (3 fails = 5min cooldown), try next
  → setToCache(prompt, response, TTL)
  → logRequest to SQLite
  → return JSON response
```

---

## /ask Request & Response

```json
// Request
POST /ask
Headers: { "x-api-key": "mykey1", "Content-Type": "application/json" }
Body: {
  "prompt": "What is machine learning?",
  "provider": "auto",        // optional: "auto" | "gemini" | "groq" | etc.
  "max_tokens": 1000,        // optional, default 1000
  "temperature": 0.7,        // optional, default 0.7
  "cache": true              // optional, default true
}

// Success Response
{
  "success": true,
  "response": "Machine learning is...",
  "provider": "gemini",
  "cached": false,
  "latency_ms": 1200,
  "request_id": "req_abc123",
  "remaining_quota": { "gemini": 1420, "groq": 14000 }
}

// Error Response
{
  "success": false,
  "error": "All providers exhausted",
  "request_id": "req_abc123",
  "retry_after": 30
}
```

---

## Admin API Routes (all require x-admin-password header)

```
GET    /admin/stats              → dashboard stats
GET    /admin/providers          → list providers + health + quota
PUT    /admin/providers/:name    → { enabled: true/false }
PUT    /admin/providers-priority → { priority: ["gemini","groq",...] }
GET    /admin/logs               → paginated logs (query: limit, offset, provider, cached, success, search)
GET    /admin/logs/export        → CSV download
GET    /admin/cache/stats        → { enabled, keys }
DELETE /admin/cache              → clear all cache
GET    /admin/settings           → current config values
POST   /admin/playground         → test prompt (same as /ask but no cache)
GET    /admin/health             → provider health states
```

---

## SQLite Tables

```sql
request_logs (id, request_id, timestamp, prompt, provider_used, cached, latency_ms, success, error_message, client_ip, api_key_used)
provider_stats (id, provider, date, requests_made, requests_failed, avg_latency_ms, cache_hits)
settings (key, value)   -- stores: provider_priority, provider_enabled
```

---

## Environment Variables (.env)

```env
PORT=3000
NODE_ENV=production
ALLOWED_API_KEYS=mykey1,mykey2,mykey3     # comma-separated, checked via x-api-key header
ADMIN_PASSWORD=supersecretadmin123         # checked via x-admin-password header

UPSTASH_REDIS_URL=https://your-redis.upstash.io
UPSTASH_REDIS_TOKEN=your-token

GEMINI_API_KEY=
GROQ_API_KEY=
HUGGINGFACE_API_KEY=
COHERE_API_KEY=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
OPENROUTER_API_KEY=
OLLAMA_HOST=http://localhost:11434

PROVIDER_TIMEOUT_MS=5000
MAX_RETRIES=3
HEALTH_COOLDOWN_MINUTES=5
DEFAULT_CACHE_TTL_SECONDS=86400
FACTUAL_CACHE_TTL_SECONDS=604800
TIMESENSITIVE_CACHE_TTL_SECONDS=3600
```

---

## How to Run

```bash
cd C:\Users\Dhruv Tilva\Desktop\nexus-ai\server
cp .env.example .env    # fill in your API keys
npm install
npm start
# Backend: http://localhost:3000
# Admin:   http://localhost:3000/admin-panel
```

---

## Admin Panel Pages (admin/index.html — single file)

| Page | What it shows |
|------|--------------|
| Dashboard | Stats cards (total, cache rate, active providers, failed), hourly chart, provider pie chart, recent logs |
| Providers | Cards per provider — toggle on/off, quota bar, health status |
| Logs | Full request log table with filters (provider, cached, search) + CSV export |
| Playground | Text prompt → send → see response, provider used, latency |
| Settings | Cache stats + clear, drag-to-reorder provider priority, config display |

---

## Key Design Decisions

1. **No React** — plain HTML + Tailwind CDN + Vanilla JS (simple to maintain, no build step)
2. **Provider state in memory** — `requestsToday` resets daily via `_resetIfNewDay()` on each call
3. **Priority stored in SQLite** — survives server restarts, editable via admin panel
4. **Cache key** = `"ai:" + sha256(normalized_prompt)` — normalizer removes filler words, lowercases, sorts words for semantic dedup
5. **Deduplication** — in-memory Map with Promise sharing, cleaned up after 30s
6. **Health tracking** — in-memory per provider: 3 failures → 5min cooldown → auto-recover
7. **Admin served as static** — Express serves `admin/` folder at `/admin-panel`

---

## Current Status

- All files built and ready
- Needs: `npm install` + `.env` file with API keys to run
- No bugs known — all providers follow identical interface pattern
- Future upgrade path: swap model name in provider file, add new provider file + register in `config/providers.js`
