# NexusAI — Codebase Reference Guide

> Use this file whenever you want to change, add, or fix anything in the project.
> Every section tells you **exactly which file and line** to go to.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Full File Structure](#2-full-file-structure)
3. [Entry Point & Server Setup](#3-entry-point--server-setup)
4. [API Routes](#4-api-routes)
5. [Providers (AI Backends)](#5-providers-ai-backends)
6. [Services (Core Logic)](#6-services-core-logic)
7. [Middleware](#7-middleware)
8. [Database (SQLite)](#8-database-sqlite)
9. [Admin Panel (Frontend)](#9-admin-panel-frontend)
10. [Admin API Client](#10-admin-api-client)
11. [Environment Variables](#11-environment-variables)
12. [Common Tasks — Where to Make Changes](#12-common-tasks--where-to-make-changes)

---

## 1. Project Overview

NexusAI is a personal AI API gateway. One `/ask` endpoint, 7 free AI providers, smart routing with auto-fallback, Redis caching, and request deduplication.

- **Backend:** Node.js + Express — `server/`
- **Frontend:** Plain HTML + Tailwind CDN — `admin/`
- **Database:** SQLite (better-sqlite3) — `server/nexusai.db`
- **Cache:** Upstash Redis (free tier)
- **Hosting:** Render.com (backend) + Vercel (admin panel)

**Live URLs (after deployment):**
- API: `https://nexus-ai-tobh.onrender.com/ask`
- Health: `https://nexus-ai-tobh.onrender.com/health`
- Admin: `https://nexus-ai-tobh.onrender.com/admin-panel`

---

## 2. Full File Structure

```
nexus-ai/
├── CODEBASE_REFERENCE.md       ← YOU ARE HERE
├── NEXUSAI_CONTEXT.md          ← Full project context for AI agents
├── README.md
├── .gitignore
│
├── server/
│   ├── index.js                ← Entry point, app startup
│   ├── package.json            ← Dependencies
│   ├── .env                    ← Your actual secrets (not committed)
│   ├── .env.example            ← Template for env vars
│   ├── nexusai.db              ← SQLite database file (auto-created)
│   │
│   ├── config/
│   │   └── providers.js        ← Loads all 7 providers, manages priority
│   │
│   ├── db/
│   │   └── sqlite.js           ← DB init, table creation
│   │
│   ├── middleware/
│   │   ├── auth.js             ← API key + admin password auth
│   │   ├── cors.js             ← CORS (allows all origins)
│   │   └── rateLimit.js        ← Rate limiting (30/min API, 60/min admin)
│   │
│   ├── providers/
│   │   ├── gemini.js           ← Google Gemini 2.0 Flash
│   │   ├── groq.js             ← Groq llama-3.1-8b-instant
│   │   ├── huggingface.js      ← HuggingFace Mistral-7B
│   │   ├── cohere.js           ← Cohere command-r-08-2024
│   │   ├── cloudflare.js       ← Cloudflare Workers AI llama-3.1-8b
│   │   ├── openrouter.js       ← OpenRouter llama-3.1-8b free
│   │   └── ollama.js           ← Self-hosted Ollama llama3.1:8b
│   │
│   ├── routes/
│   │   ├── ask.js              ← POST /ask (main API endpoint)
│   │   ├── admin.js            ← /admin/* (protected admin routes)
│   │   └── health.js           ← GET /health, GET /providers
│   │
│   └── services/
│       ├── router.js           ← Smart routing + health tracking
│       ├── cache.js            ← Redis get/set/clear
│       ├── normalizer.js       ← Prompt normalization + cache key hash
│       ├── deduplicator.js     ← Prevents duplicate in-flight requests
│       └── logger.js           ← SQLite logging + stats
│
└── admin/
    ├── index.html              ← Entire admin panel (single file)
    ├── favicon.png             ← Browser tab icon (smiley)
    └── utils/
        └── api.js              ← Admin API client (JS fetch wrappers)
```

---

## 3. Entry Point & Server Setup

**File:** `server/index.js`

| Line | What it does |
|------|-------------|
| 13 | `PORT = process.env.PORT \|\| 3000` — change default port here |
| 20 | `app.use('/admin-panel', express.static(...))` — admin panel URL path |
| 23–25 | Route registration: health, ask, admin |
| 28–48 | `start()` — startup sequence: DB → Cache → Providers → Listen |

**To add a new route:**
1. Create file in `server/routes/yourroute.js`
2. Register at line 23–25 in `server/index.js`

---

## 4. API Routes

### POST /ask — Main Endpoint
**File:** `server/routes/ask.js`

| Line | What it does |
|------|-------------|
| 12 | Route handler — `router.post('/ask', askLimiter, apiKeyAuth, ...)` |
| 15 | Destructure body: `prompt, provider, max_tokens, temperature, cache` |
| 17–19 | Prompt validation — returns 400 if empty |
| 23–42 | Cache check — returns cached response if found |
| 45–47 | Deduplication + routing |
| 52–54 | Cache the response after successful call |
| 61–69 | Success response shape |
| 78–84 | Error response (503 if all providers fail) |
| 87–96 | `getQuotaSummary()` — returns remaining quota per provider |

**Response format:**
```json
{
  "success": true,
  "response": "...",
  "provider": "groq",
  "cached": false,
  "latency_ms": 843,
  "request_id": "req_abc123",
  "remaining_quota": { "gemini": 1498, "groq": 14399 }
}
```

---

### Admin Routes
**File:** `server/routes/admin.js`

| Line | Route | Description |
|------|-------|-------------|
| 13–14 | All routes | Apply rate limit + admin auth |
| 17–33 | `GET /admin/stats` | Dashboard stats (requests, cache hits, provider usage) |
| 36–50 | `GET /admin/providers` | List all providers with quota + health |
| 53–71 | `PUT /admin/providers/:name` | Toggle provider enable/disable |
| 74–85 | `PUT /admin/providers-priority` | Reorder provider priority |
| 88–101 | `GET /admin/logs` | Filtered request logs |
| 104–109 | `GET /admin/logs/export` | Download logs as CSV |
| 112–115 | `GET /admin/cache/stats` | Redis key count |
| 118–121 | `DELETE /admin/cache` | Clear all cached responses |
| 124–138 | `GET /admin/settings` | Current config values |
| 141–153 | `POST /admin/playground` | Test a prompt directly |
| 156–159 | `GET /admin/health` | Per-provider health status |

---

### Public Health Routes
**File:** `server/routes/health.js`

| Line | Route | Description |
|------|-------|-------------|
| 8–20 | `GET /health` | Server uptime, active providers count, cache status |
| 22–32 | `GET /providers` | Public provider list (no auth) |

---

## 5. Providers (AI Backends)

All providers follow the same interface:
```javascript
{ name, displayName, isEnabled, dailyLimit, requestsToday,
  async ask(prompt, options), async checkHealth(), getQuotaRemaining(), _resetIfNewDay() }
```

---

### Gemini — `server/providers/gemini.js`
- **Model:** `gemini-2.0-flash` (free tier)
- **Free limit:** 1,500 req/day, 15 req/min
- **Env var:** `GEMINI_API_KEY`
- **API key:** https://aistudio.google.com/app/apikey
- **To change model:** Find line with `gemini-2.0-flash` and update

---

### Groq — `server/providers/groq.js`
- **Model:** `llama-3.1-8b-instant`
- **Free limit:** 14,400 req/day
- **Env var:** `GROQ_API_KEY`
- **API key:** https://console.groq.com/keys
- **To change model:** Find line with `llama-3.1-8b-instant` and update

---

### HuggingFace — `server/providers/huggingface.js`
- **Model:** `mistralai/Mistral-7B-Instruct-v0.3`
- **API endpoint:** `https://router.huggingface.co/hf-inference/models/{model}/v1/chat/completions` (line 22)
- **Free limit:** ~1,000 req/day
- **Env var:** `HUGGINGFACE_API_KEY`
- **API key:** https://huggingface.co/settings/tokens
- **To change model:** Line 16 — `options.model || 'mistralai/Mistral-7B-Instruct-v0.3'`

---

### Cohere — `server/providers/cohere.js`
- **Model:** `command-r-08-2024` (line 28)
- **Free limit:** ~1,000 req/month (trial key)
- **Env var:** `COHERE_API_KEY`
- **API key:** https://dashboard.cohere.com/api-keys
- **To change model:** Line 28 — `options.model || 'command-r-08-2024'`

---

### Cloudflare — `server/providers/cloudflare.js`
- **Model:** `@cf/meta/llama-3.1-8b-instruct`
- **Free limit:** 10,000 neurons/day
- **Env vars:** `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`
- **API key:** https://dash.cloudflare.com/ → My Profile → API Tokens
- **To change model:** Find line with `llama-3.1-8b-instruct`

---

### OpenRouter — `server/providers/openrouter.js`
- **Model:** `meta-llama/llama-3.1-8b-instruct:free`
- **Free limit:** varies (free models available)
- **Env var:** `OPENROUTER_API_KEY`
- **API key:** https://openrouter.ai/keys
- **To change model:** Find line with `:free` model name

---

### Ollama (Self-hosted) — `server/providers/ollama.js`
- **Model:** `llama3.1:8b` (line 23) — override with `OLLAMA_MODEL` env var
- **Free limit:** Unlimited (self-hosted)
- **Env vars:** `OLLAMA_HOST` (default: `http://localhost:11434`), `OLLAMA_MODEL`
- **Timeout:** Line 14 — defaults to `PROVIDER_TIMEOUT_MS` or 10 seconds
- **To change default model:** Line 23 — `process.env.OLLAMA_MODEL || 'llama3.1:8b'`
- **To change host:** Line 13 — `process.env.OLLAMA_HOST || 'http://localhost:11434'`

---

### How to Add a New Provider

1. Create `server/providers/myprovider.js` — copy any existing provider as template
2. Register in `server/config/providers.js`:
   - Line 1–7: Add `require('../providers/myprovider')`
   - Line 11: Add name to `DEFAULT_PRIORITY` array
   - Line 13–21: Add to `providerMap`

---

## 6. Services (Core Logic)

### Smart Router — `server/services/router.js`

| Line | What it does |
|------|-------------|
| 4 | `healthState` — in-memory object tracking failures per provider |
| 6–11 | `getHealthState(name)` — init state if not exists |
| 13–24 | `isHealthy(name)` — returns false if in cooldown, auto-recovers after |
| 26–38 | `markFailure(name)` — increments failures, triggers cooldown after 3 |
| 31 | `maxFailures = 3` — change to require more/fewer failures before cooldown |
| 32 | `cooldownMin` — reads from `HEALTH_COOLDOWN_MINUTES` env var |
| 40–44 | `markSuccess(name)` — resets failures after a successful call |
| 46–57 | `route()` with specific provider — bypasses auto-routing |
| 59–83 | `route()` auto-mode — iterates ordered providers, skips unhealthy/disabled/quota-0 |
| 82 | Error thrown if all providers fail |
| 85–95 | `getHealthStatus()` — returns health object for admin panel |

**To change failure threshold:** Line 31 — `const maxFailures = 3`
**To change cooldown:** Set `HEALTH_COOLDOWN_MINUTES` in `.env`

---

### Cache — `server/services/cache.js`

| Line | What it does |
|------|-------------|
| 6–16 | `initCache()` — connects to Redis using env vars |
| 18–28 | `getFromCache(prompt)` — returns cached response or null |
| 21 | Cache key format: `'ai:' + sha256(normalized_prompt)` |
| 30–39 | `setToCache(prompt, response)` — stores with TTL |
| 41–48 | `clearCache()` — flushes entire Redis DB |
| 50–58 | `getCacheStats()` — returns key count |

**Cache is disabled if** `UPSTASH_REDIS_URL` or `UPSTASH_REDIS_TOKEN` are missing.

---

### Normalizer — `server/services/normalizer.js`

| Line | What it does |
|------|-------------|
| 4–9 | `FILLER_WORDS` set — words removed before hashing (add/remove words here) |
| 11–25 | `normalize(prompt)` — lowercase, remove punctuation, remove fillers, sort words |
| 27–30 | `hashPrompt(prompt)` — SHA-256 of normalized prompt → cache key |
| 33–50 | `getTTL(prompt)` — returns TTL in seconds based on prompt type |
| 40 | Time-sensitive detection (today, current, latest...) → 1 hour TTL |
| 45 | Factual detection (what is, define, explain...) → 7 day TTL |
| 47 | Default TTL → 1 day (from `DEFAULT_CACHE_TTL_SECONDS`) |

**To add time-sensitive keywords:** Line 40 — extend the regex pattern.
**To add factual patterns:** Line 45 — extend the regex pattern.
**To change TTLs:** Set env vars `DEFAULT_CACHE_TTL_SECONDS`, `FACTUAL_CACHE_TTL_SECONDS`, `TIMESENSITIVE_CACHE_TTL_SECONDS`

---

### Deduplicator — `server/services/deduplicator.js`

| Line | What it does |
|------|-------------|
| 4 | `inFlight` Map — tracks in-progress requests by prompt hash |
| 7–14 | Cleanup interval — removes stale entries every 30 seconds |
| 21–41 | `deduplicate(prompt, fetchFn)` — if same prompt already in-flight, return same promise |
| 31 | 2 second delay before removing resolved entry — allows concurrent waiters to resolve |

---

### Logger — `server/services/logger.js`

| Line | What it does |
|------|-------------|
| 3–37 | `logRequest({...})` — inserts into `request_logs` + updates `provider_stats` |
| 39–59 | `getLogs({...})` — filterable query: provider, cached, success, search, date range |
| 61–86 | `getStats()` — today's counts, cache hit rate, provider usage, hourly chart data |
| 88–95 | `exportLogsCSV()` — returns CSV string for download |

---

## 7. Middleware

### Auth — `server/middleware/auth.js`

| Line | What it does |
|------|-------------|
| 2–20 | `apiKeyAuth` — checks `x-api-key` header against `ALLOWED_API_KEYS` env var |
| 6–9 | If no keys configured → open access (dev mode) |
| 23–33 | `adminAuth` — checks `x-admin-password` header or `?password=` query param |
| 25 | If no `ADMIN_PASSWORD` set → open access |

**To add/change API keys:** Update `ALLOWED_API_KEYS` in `.env` (comma-separated)
**To change admin password:** Update `ADMIN_PASSWORD` in `.env`

---

### Rate Limiting — `server/middleware/rateLimit.js`

| Line | What it does |
|------|-------------|
| 3–9 | `askLimiter` — 30 requests/minute per IP for `/ask` |
| 4 | `windowMs: 60 * 1000` — change window duration |
| 5 | `max: 30` — change max requests per window |
| 11–17 | `adminLimiter` — 60 requests/minute per IP for admin routes |

---

### CORS — `server/middleware/cors.js`
Allows all origins. Edit this file if you want to restrict to specific domains.

---

## 8. Database (SQLite)

**File:** `server/db/sqlite.js`
**DB file location:** `server/nexusai.db` (auto-created on first run)

### Tables

| Table | Columns | Purpose |
|-------|---------|---------|
| `request_logs` | id, request_id, timestamp, prompt, provider_used, cached, latency_ms, success, error_message, client_ip, api_key_used | Every API request |
| `provider_stats` | id, provider, date, requests_made, requests_failed, avg_latency_ms, cache_hits | Daily per-provider stats |
| `settings` | key, value | Persisted settings (provider priority, enabled states) |

**Schema defined at:** Lines 10–40 in `server/db/sqlite.js`

**Settings keys stored:**
- `provider_priority` — JSON array of provider names in order
- `provider_enabled` — JSON object `{ gemini: true, groq: false, ... }`

---

## 9. Admin Panel (Frontend)

**File:** `admin/index.html` — Single HTML file, no build step.

### Pages Inside the File

Search for these IDs to find each page's HTML:

| Page | HTML ID | Search for |
|------|---------|------------|
| Dashboard | `page-dashboard` | `id="page-dashboard"` |
| Providers | `page-providers` | `id="page-providers"` |
| Logs | `page-logs` | `id="page-logs"` |
| Playground | `page-playground` | `id="page-playground"` |
| Settings | `page-settings` | `id="page-settings"` |
| Quick Guide | `page-guide` | `id="page-guide"` |
| About | `page-about` | `id="page-about"` |

### Key JavaScript Functions

Search in `admin/index.html` for these function names:

| Function | What it does |
|----------|-------------|
| `navigateTo(page)` | Switch between pages, update active sidebar link |
| `loadPage(page)` | Calls the right data-loading function for each page |
| `loadDashboard()` | Fetches `/admin/stats`, renders charts and cards |
| `loadProviders()` | Fetches `/admin/providers`, renders provider cards |
| `toggleProvider(name, enabled)` | Calls PUT `/admin/providers/:name` |
| `loadLogs()` | Fetches `/admin/logs` with filters |
| `exportLogs()` | Triggers CSV download |
| `sendPlayground()` | Calls POST `/admin/playground` |
| `loadSettings()` | Fetches `/admin/settings`, renders priority drag list |
| `savePriority()` | Calls PUT `/admin/providers-priority` |
| `clearCache()` | Calls DELETE `/admin/cache` |
| `showLoginModal()` | Shows password prompt when 401 received |

### Sidebar Navigation
Search for `sidebar-link` class to find all nav items.
To add a new page: add a `<a class="sidebar-link" data-page="yourpage">` and a corresponding `<div id="page-yourpage" class="page">`.

### Favicon
**File:** `admin/favicon.png` — the smiley face icon.
Referenced in `admin/index.html` as `<link rel="icon" type="image/png" href="favicon.png">` (line 7).

### Branding
Search for `DT's Crafted` to find the brand name in the sidebar footer.

---

## 10. Admin API Client

**File:** `admin/utils/api.js`

| Line | What it does |
|------|-------------|
| 2 | `API_BASE = window.location.origin` — auto-detects backend URL |
| 4–6 | `getAdminPassword()` — reads from localStorage |
| 12–26 | `api(path, options)` — base fetch wrapper, adds auth header |
| 29–43 | `adminAPI` object — shorthand methods for all admin endpoints |

**For Vercel deployment:** Change line 2 to hardcode your Render URL:
```javascript
const API_BASE = 'https://nexus-ai-tobh.onrender.com';
```

---

## 11. Environment Variables

**Files:** `server/.env` (actual), `server/.env.example` (template)

| Variable | Where Used | Description |
|----------|-----------|-------------|
| `PORT` | `server/index.js:13` | Server port (default 3000) |
| `ALLOWED_API_KEYS` | `server/middleware/auth.js:4` | Comma-separated API keys |
| `ADMIN_PASSWORD` | `server/middleware/auth.js:24` | Admin panel password |
| `UPSTASH_REDIS_URL` | `server/services/cache.js:7` | Redis connection URL |
| `UPSTASH_REDIS_TOKEN` | `server/services/cache.js:8` | Redis auth token |
| `GEMINI_API_KEY` | `server/providers/gemini.js` | Google AI Studio key |
| `GROQ_API_KEY` | `server/providers/groq.js` | Groq Console key |
| `HUGGINGFACE_API_KEY` | `server/providers/huggingface.js:13` | HuggingFace token |
| `COHERE_API_KEY` | `server/providers/cohere.js:13` | Cohere API key |
| `CLOUDFLARE_ACCOUNT_ID` | `server/providers/cloudflare.js` | CF Account ID |
| `CLOUDFLARE_API_TOKEN` | `server/providers/cloudflare.js` | CF API Token |
| `OPENROUTER_API_KEY` | `server/providers/openrouter.js` | OpenRouter key |
| `OLLAMA_HOST` | `server/providers/ollama.js:13` | Ollama server URL |
| `OLLAMA_MODEL` | `server/providers/ollama.js:23` | Override default model |
| `PROVIDER_TIMEOUT_MS` | All providers (timeout line) | Per-request timeout |
| `HEALTH_COOLDOWN_MINUTES` | `server/services/router.js:32` | Unhealthy provider cooldown |
| `DEFAULT_CACHE_TTL_SECONDS` | `server/services/normalizer.js:37` | Default cache TTL (86400 = 1 day) |
| `FACTUAL_CACHE_TTL_SECONDS` | `server/services/normalizer.js:35` | Factual query TTL (604800 = 7 days) |
| `TIMESENSITIVE_CACHE_TTL_SECONDS` | `server/services/normalizer.js:36` | Time-sensitive TTL (3600 = 1 hour) |

---

## 12. Common Tasks — Where to Make Changes

### Add a new AI provider
1. Create `server/providers/newprovider.js` (copy existing as template)
2. `server/config/providers.js` line 1–7 — add require
3. `server/config/providers.js` line 11 — add to `DEFAULT_PRIORITY`
4. `server/config/providers.js` line 13–21 — add to `providerMap`

### Change default AI model for a provider
- Gemini: `server/providers/gemini.js` — find `gemini-2.0-flash`
- Groq: `server/providers/groq.js` — find `llama-3.1-8b-instant`
- HuggingFace: `server/providers/huggingface.js` line 16
- Cohere: `server/providers/cohere.js` line 28
- Ollama: `server/providers/ollama.js` line 23 or set `OLLAMA_MODEL` env var

### Change API rate limits
- `/ask` endpoint: `server/middleware/rateLimit.js` line 5 — `max: 30`
- Admin panel: `server/middleware/rateLimit.js` line 13 — `max: 60`

### Change health check thresholds
- Failure count before cooldown: `server/services/router.js` line 31
- Cooldown duration: `HEALTH_COOLDOWN_MINUTES` in `.env`

### Add a new admin panel page
1. `admin/index.html` — add sidebar link: `<a class="sidebar-link" data-page="mypage">`
2. `admin/index.html` — add page div: `<div id="page-mypage" class="page">`
3. `admin/index.html` — add case in `loadPage()` function
4. If needs API data, add method to `admin/utils/api.js`

### Add a new admin API endpoint
1. `server/routes/admin.js` — add new `router.get/post/put/delete`
2. `admin/utils/api.js` — add shorthand in `adminAPI` object

### Change cache TTL rules
- Add/remove time-sensitive keywords: `server/services/normalizer.js` line 40
- Add/remove factual query patterns: `server/services/normalizer.js` line 45
- Change TTL values: env vars in `.env`

### Add filler words to improve cache matching
- `server/services/normalizer.js` lines 4–9 — add words to `FILLER_WORDS` Set

### Change admin panel branding
- Brand name: search `DT's Crafted` in `admin/index.html`
- Page title: `admin/index.html` line 6 — `<title>NexusAI — Admin Panel</title>`
- Favicon: replace `admin/favicon.png`

### Change provider priority order (code default)
- `server/config/providers.js` line 11 — `DEFAULT_PRIORITY` array
- Runtime: use Settings page in admin panel (persists to SQLite)

### Change server port
- `server/index.js` line 13 — `process.env.PORT || 3000`
- Or set `PORT` in `.env`

### View/query the SQLite database directly
```bash
cd server
npx better-sqlite3 nexusai.db
# or install sqlite3 CLI:
sqlite3 nexusai.db
.tables
SELECT * FROM request_logs ORDER BY timestamp DESC LIMIT 10;
```

### Run locally
```bash
cd server
cp .env.example .env   # fill in your keys
npm install
npm start
# http://localhost:3000/health
# http://localhost:3000/admin-panel
```

---

*Last updated: 2026-03-29*
