# 🚀 MEGA PROMPT — Build Complete Zero-Cost AI API Manager

> **Paste this entire prompt into Claude Pro / VS Code Agent / Claude Code**

---

You are an elite full-stack engineer. Build me a COMPLETE, PRODUCTION-READY **Zero-Cost AI API Manager** — a self-hosted platform that acts as my own AI API gateway. I hit one endpoint `/ask`, and it intelligently routes my prompt to free AI providers, caches responses, and returns the answer. I can integrate this API into ANY app or website.

---

## 🎯 PROJECT OVERVIEW

**Name:** FreeAI Hub (or suggest a cool name)
**What it is:** A unified AI API platform that combines multiple FREE AI providers behind a single endpoint. It includes smart routing, caching, fallback logic, and an admin dashboard.
**Tech Stack:** Node.js + Express (backend), React + Tailwind CSS (admin panel), Upstash Redis (free cache), SQLite (logs DB)
**Deployment Target:** Render.com free tier (backend) + Vercel free tier (admin panel)

---

## 📁 PROJECT STRUCTURE

```
ai-api-manager/
├── server/
│   ├── index.js                  # Express server entry point
│   ├── config/
│   │   └── providers.js          # Provider configurations & API keys (from env)
│   ├── routes/
│   │   ├── ask.js                # Main /ask endpoint
│   │   ├── admin.js              # Admin API routes
│   │   └── health.js             # Health check endpoint
│   ├── services/
│   │   ├── router.js             # Smart routing engine (priority, fallback, retry)
│   │   ├── cache.js              # Redis caching layer (Upstash)
│   │   ├── normalizer.js         # Prompt normalization (for cache hit optimization)
│   │   ├── deduplicator.js       # Request deduplication (batch identical requests)
│   │   └── logger.js             # Request logging to SQLite
│   ├── providers/
│   │   ├── gemini.js             # Google Gemini free API
│   │   ├── groq.js               # Groq free API
│   │   ├── huggingface.js        # HuggingFace Inference API
│   │   ├── cohere.js             # Cohere free tier
│   │   ├── cloudflare.js         # Cloudflare Workers AI
│   │   ├── openrouter.js         # OpenRouter free models
│   │   └── ollama.js             # Ollama (self-hosted fallback)
│   ├── middleware/
│   │   ├── auth.js               # API key authentication for /ask
│   │   ├── rateLimit.js          # Rate limiting per client
│   │   └── cors.js               # CORS configuration
│   ├── db/
│   │   └── sqlite.js             # SQLite setup for logs
│   ├── .env.example              # Environment variable template
│   └── package.json
├── admin/
│   ├── src/
│   │   ├── App.jsx               # Main app with routing
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx     # Overview: stats, graphs, status
│   │   │   ├── Providers.jsx     # Manage providers: enable/disable, keys, status
│   │   │   ├── Logs.jsx          # Request logs table with filters
│   │   │   ├── Settings.jsx      # Routing config, cache TTL, API keys
│   │   │   └── Playground.jsx    # Test /ask endpoint from browser
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── StatusCard.jsx
│   │   │   ├── ProviderCard.jsx
│   │   │   ├── LogsTable.jsx
│   │   │   └── StatsChart.jsx
│   │   └── utils/
│   │       └── api.js            # Admin API client
│   ├── package.json
│   └── tailwind.config.js
├── docs/
│   ├── SETUP.md                  # Step-by-step setup guide
│   ├── API_DOCS.md               # API documentation for /ask endpoint
│   └── DEPLOYMENT.md             # How to deploy on Render + Vercel
├── docker-compose.yml            # Optional: local dev with Docker
└── README.md                     # Project overview
```

---

## 🔌 MAIN API ENDPOINT — `/ask`

### Request:
```json
POST /ask
Headers: { "x-api-key": "your-secret-key" }
Body: {
  "prompt": "What is machine learning?",
  "provider": "auto",          // optional: "auto", "gemini", "groq", etc.
  "max_tokens": 1000,          // optional
  "temperature": 0.7,          // optional
  "cache": true,               // optional: default true
  "session_id": "user123"      // optional: for conversation tracking
}
```

### Response:
```json
{
  "success": true,
  "response": "Machine learning is a subset of AI...",
  "provider": "gemini",
  "cached": false,
  "latency_ms": 1200,
  "request_id": "req_abc123",
  "remaining_quota": {
    "gemini": 1420,
    "groq": 14000
  }
}
```

### Error Response:
```json
{
  "success": false,
  "error": "All providers exhausted",
  "retry_after": 30
}
```

---

## 🧠 SMART ROUTING ENGINE — `router.js`

Build an intelligent routing system:

### Priority Order (configurable via admin):
1. **Google Gemini** (best quality, primary)
2. **Groq** (fastest, secondary)
3. **Cloudflare Workers AI** (high limit, 10K/day)
4. **HuggingFace** (free, slower)
5. **Cohere** (limited but decent)
6. **OpenRouter** (free model aggregator)
7. **Ollama** (self-hosted, unlimited, last fallback)

### Routing Logic:
```
function route(prompt):
  for each provider in priority_order:
    if provider.is_enabled AND provider.has_quota AND provider.is_healthy:
      try:
        response = await provider.ask(prompt, timeout=5000ms)
        log_success(provider, latency)
        return response
      catch:
        log_failure(provider, error)
        mark_provider_unhealthy(provider, cooldown=5min)
        continue
  
  return error("All providers exhausted")
```

### Health Tracking:
- Track success/failure count per provider
- If provider fails 3 times in 5 minutes → mark unhealthy, skip for 5 minutes
- Auto-recover after cooldown period
- Store health state in Redis

---

## 🗄️ CACHING LAYER — `cache.js`

Use **Upstash Redis** (free tier: 10K commands/day, 256MB).

### Cache Strategy:
```
function handleRequest(prompt):
  normalized = normalize(prompt)           // lowercase, trim, remove filler
  cacheKey = "ai:" + sha256(normalized)
  
  cached = await redis.get(cacheKey)
  if cached:
    return { response: cached, cached: true }
  
  response = await router.route(prompt)
  
  ttl = getTTL(prompt)                     // factual=7days, conversational=1hr
  await redis.set(cacheKey, response, ttl)
  
  return { response, cached: false }
```

### Prompt Normalization — `normalizer.js`:
- Convert to lowercase
- Trim whitespace
- Remove filler words ("please", "can you", "tell me", "hey", "um")
- Remove punctuation variations
- Sort words alphabetically for semantic matching
- Example: "Hey, can you please tell me what is AI?" → "ai what is"

### TTL Logic:
- Questions starting with "what is", "define", "explain" → 7 days (factual)
- Questions with "today", "current", "latest", "now" → 1 hour (time-sensitive)
- Default → 24 hours

---

## 🔁 REQUEST DEDUPLICATION — `deduplicator.js`

If 10 identical requests arrive within 2 seconds:
- Only 1 actual API call is made
- Other 9 requests wait for the same response
- Use a Map to track in-flight requests by normalized prompt hash
- When response arrives, resolve all waiting promises

---

## 🔗 PROVIDER IMPLEMENTATIONS

### Each provider file must export:
```javascript
module.exports = {
  name: "gemini",
  displayName: "Google Gemini",
  isEnabled: true,
  dailyLimit: 1500,
  requestsToday: 0,
  
  async ask(prompt, options = {}) {
    // Call the provider's API
    // Return plain text response
    // Throw on error/rate-limit
  },
  
  async checkHealth() {
    // Return true/false
  },
  
  getQuotaRemaining() {
    return this.dailyLimit - this.requestsToday;
  }
}
```

### Provider Details:

**1. Google Gemini (`gemini.js`)**
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
- Auth: API key as query param `?key=YOUR_KEY`
- Free: 15 RPM, 1,500 RPD
- Body: `{ contents: [{ parts: [{ text: prompt }] }] }`

**2. Groq (`groq.js`)**
- Endpoint: `https://api.groq.com/openai/v1/chat/completions`
- Auth: Bearer token
- Model: `llama-3.1-8b-instant` or `mixtral-8x7b-32768`
- Free: 30 RPM, 14,400 RPD (model dependent)
- Body: OpenAI-compatible format

**3. HuggingFace (`huggingface.js`)**
- Endpoint: `https://api-inference.huggingface.co/models/{model}`
- Auth: Bearer token
- Model: `mistralai/Mistral-7B-Instruct-v0.3` or `meta-llama/Llama-3.1-8B-Instruct`
- Free: Rate limited, ~1000/day
- Body: `{ inputs: prompt, parameters: { max_new_tokens: 500 } }`

**4. Cohere (`cohere.js`)**
- Endpoint: `https://api.cohere.ai/v2/chat`
- Auth: Bearer token
- Free: 5 RPM, ~1000/month on trial
- Body: `{ model: "command-r", messages: [{ role: "user", content: prompt }] }`

**5. Cloudflare Workers AI (`cloudflare.js`)**
- Endpoint: `https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/meta/llama-3.1-8b-instruct`
- Auth: Bearer token
- Free: 10,000 neurons/day
- Body: `{ messages: [{ role: "user", content: prompt }] }`

**6. OpenRouter (`openrouter.js`)**
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Auth: Bearer token
- Free models available (check docs)
- Body: OpenAI-compatible format

**7. Ollama (`ollama.js`)**
- Endpoint: `http://{OLLAMA_HOST}:11434/api/generate`
- No auth needed (self-hosted)
- Model: `phi3:mini` or `tinyllama`
- Body: `{ model: "phi3:mini", prompt: prompt, stream: false }`
- This is the LAST fallback — unlimited but slow on CPU

---

## 🔐 AUTHENTICATION — `auth.js`

Simple API key auth:
- Store allowed API keys in env: `ALLOWED_API_KEYS=key1,key2,key3`
- Check `x-api-key` header on every `/ask` request
- Admin panel has separate auth: `ADMIN_PASSWORD=your-admin-password`
- Return 401 if unauthorized

---

## 📊 LOGGING — `logger.js` + `sqlite.js`

Log every request to SQLite:

```sql
CREATE TABLE request_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  prompt TEXT,
  provider_used TEXT,
  cached BOOLEAN,
  latency_ms INTEGER,
  success BOOLEAN,
  error_message TEXT,
  client_ip TEXT,
  api_key_used TEXT
);

CREATE TABLE provider_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT,
  date DATE,
  requests_made INTEGER DEFAULT 0,
  requests_failed INTEGER DEFAULT 0,
  avg_latency_ms REAL,
  cache_hits INTEGER DEFAULT 0
);
```

---

## 🖥️ ADMIN PANEL — Full React Dashboard

### Design Style:
- Dark theme, modern, clean
- Sidebar navigation
- Real-time stats with auto-refresh

### Pages:

**1. Dashboard (`Dashboard.jsx`)**
- Total requests today (number card)
- Cache hit rate % (number card with green/red indicator)
- Active providers count (number card)
- Requests per hour (line chart — last 24 hours)
- Provider usage breakdown (pie chart)
- Recent requests (last 10, mini table)

**2. Providers (`Providers.jsx`)**
- Card for each provider showing:
  - Name + status (green dot = active, red = down)
  - Quota used / remaining (progress bar)
  - Average latency
  - Toggle switch to enable/disable
  - API key input field (masked, editable)
  - "Test" button to send a test prompt
- Drag-and-drop to reorder priority

**3. Logs (`Logs.jsx`)**
- Full table of all requests
- Columns: Time, Prompt (truncated), Provider, Cached?, Latency, Status
- Filters: by provider, by date range, cached/uncached, success/fail
- Search bar for prompt text
- Export to CSV button

**4. Settings (`Settings.jsx`)**
- **Routing Config:**
  - Provider priority order (drag to reorder)
  - Timeout per provider (slider, 3-10 seconds)
  - Max retries before giving up
  - Cooldown time after failures
- **Cache Config:**
  - Default TTL (input)
  - Factual query TTL
  - Time-sensitive query TTL
  - "Clear All Cache" button with confirmation
  - Cache size display
- **API Keys:**
  - List of allowed client API keys
  - Add/remove keys
  - Generate random key button
- **General:**
  - Admin password change
  - CORS allowed origins

**5. Playground (`Playground.jsx`)**
- Text area to type a prompt
- Dropdown to select provider (or "auto")
- Send button
- Response display area (formatted)
- Shows: provider used, latency, cached status
- Toggle: "Force skip cache" checkbox

### Admin API Routes (`admin.js`):
```
GET    /admin/stats              → Dashboard stats
GET    /admin/providers          → List all providers + status
PUT    /admin/providers/:name    → Update provider (enable/disable, key, priority)
GET    /admin/logs               → Get logs (with pagination + filters)
GET    /admin/logs/export        → Export logs as CSV
GET    /admin/cache/stats        → Cache hit rate, size
DELETE /admin/cache              → Clear cache
GET    /admin/settings           → Get current settings
PUT    /admin/settings           → Update settings
POST   /admin/playground        → Test a prompt (same as /ask but for admin)
GET    /admin/health             → System health check
```

---

## 🌐 ADDITIONAL ENDPOINTS

```
GET  /health              → { status: "ok", uptime: "...", providers_active: 5 }
GET  /providers            → Public list of available providers (no keys exposed)
POST /ask                  → Main AI endpoint
POST /ask/stream           → (bonus) SSE streaming response
```

---

## 📦 ENVIRONMENT VARIABLES (`.env.example`)

```env
# Server
PORT=3000
NODE_ENV=production

# Authentication
ALLOWED_API_KEYS=mykey1,mykey2,mykey3
ADMIN_PASSWORD=supersecretadmin123

# Cache (Upstash Redis)
UPSTASH_REDIS_URL=https://your-redis.upstash.io
UPSTASH_REDIS_TOKEN=your-token

# Provider API Keys
GEMINI_API_KEY=your-gemini-key
GROQ_API_KEY=your-groq-key
HUGGINGFACE_API_KEY=your-hf-key
COHERE_API_KEY=your-cohere-key
CLOUDFLARE_ACCOUNT_ID=your-cf-account-id
CLOUDFLARE_API_TOKEN=your-cf-token
OPENROUTER_API_KEY=your-openrouter-key
OLLAMA_HOST=http://your-oracle-vm-ip:11434

# Routing Config
PROVIDER_TIMEOUT_MS=5000
MAX_RETRIES=3
HEALTH_COOLDOWN_MINUTES=5

# Cache Config
DEFAULT_CACHE_TTL_SECONDS=86400
FACTUAL_CACHE_TTL_SECONDS=604800
TIMESENSITIVE_CACHE_TTL_SECONDS=3600
```

---

## 📄 DOCUMENTATION FILES

### `SETUP.md` — Step by step:
1. How to get free API keys from each provider (with links)
2. How to set up Upstash Redis (free)
3. How to configure `.env`
4. How to run locally
5. How to deploy to Render (backend) and Vercel (admin panel)

### `API_DOCS.md` — For integrating into apps:
1. Authentication
2. Request/response format
3. All parameters explained
4. Error codes
5. Code examples in JavaScript, Python, cURL

### `DEPLOYMENT.md` — Free deployment:
1. Deploy backend to Render.com (free tier)
2. Deploy admin panel to Vercel (free tier)
3. Set up Upstash Redis (free tier)
4. Optional: Set up Oracle Cloud VM for Ollama
5. Connect custom domain (optional)

---

## ⚡ IMPORTANT IMPLEMENTATION NOTES

1. **DO NOT use any paid services** — everything must be on free tiers
2. **Handle rate limits gracefully** — catch 429 errors and switch providers
3. **Reset daily counters** — use a cron job or check timestamp to reset `requestsToday` at midnight
4. **Deduplication is critical** — use in-memory Map with Promise-based waiting
5. **Admin panel must be password-protected** — simple login page
6. **All provider API keys must be in .env** — never hardcoded
7. **Make routing priority configurable** — stored in SQLite settings table, editable from admin
8. **Include proper error handling** — try/catch everywhere, meaningful error messages
9. **Add request ID to every response** — for debugging via logs
10. **CORS must be configurable** — so any app/website can call the API

---

## 🏁 DELIVERABLES

Build ALL files listed in the project structure above. Every file must be complete, working, production-ready code. Include:
- Complete backend with all 7 providers
- Complete admin panel with all 5 pages
- All documentation files
- package.json with correct dependencies
- .env.example
- README.md

**The system should be ready to deploy after just adding API keys to .env.**

---

## 🧪 TESTING

After building, test these scenarios:
1. Send a prompt → get response from Gemini
2. Send same prompt → get cached response (verify `cached: true`)
3. Disable Gemini in admin → next request should use Groq
4. Send 5 identical requests simultaneously → only 1 API call should be made
5. Admin dashboard shows correct stats
6. Playground works end-to-end

---

Now build the COMPLETE system. Every file. Every function. Production-ready. Go.
