# Setup Guide

## 1. Get Free API Keys

### Google Gemini (Primary — Best Quality)
1. Go to https://aistudio.google.com/apikey
2. Click "Create API Key"
3. Copy the key → `GEMINI_API_KEY`
4. Free: 15 RPM, 1,500 requests/day

### Groq (Secondary — Fastest)
1. Go to https://console.groq.com/keys
2. Create an account → Generate API key
3. Copy → `GROQ_API_KEY`
4. Free: 30 RPM, 14,400 requests/day

### HuggingFace
1. Go to https://huggingface.co/settings/tokens
2. Create a new token (Read access)
3. Copy → `HUGGINGFACE_API_KEY`
4. Free: ~1,000 requests/day

### Cohere
1. Go to https://dashboard.cohere.com/api-keys
2. Create trial key
3. Copy → `COHERE_API_KEY`
4. Free: 5 RPM, ~1,000/month

### Cloudflare Workers AI
1. Go to https://dash.cloudflare.com → AI → Workers AI
2. Get your Account ID from the URL
3. Create an API token with Workers AI permission
4. Set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`
5. Free: 10,000 neurons/day

### OpenRouter
1. Go to https://openrouter.ai/keys
2. Create account → Generate key
3. Copy → `OPENROUTER_API_KEY`
4. Free models available

### Ollama (Optional — Self-hosted)
1. Install from https://ollama.ai
2. Run: `ollama pull phi3:mini`
3. Set `OLLAMA_HOST=http://localhost:11434`
4. Unlimited — runs on your machine

## 2. Setup Upstash Redis (Free Cache)

1. Go to https://upstash.com → Create account
2. Create a new Redis database (free tier)
3. Copy REST URL → `UPSTASH_REDIS_URL`
4. Copy REST Token → `UPSTASH_REDIS_TOKEN`

## 3. Configure Environment

```bash
cd server
cp .env.example .env
```

Edit `.env` and paste all your API keys.

## 4. Run Locally

```bash
cd server
npm install
npm start
```

Server starts at `http://localhost:3000`
Admin panel at `http://localhost:3000/admin-panel`

## 5. Test It

```bash
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -H "x-api-key: mykey1" \
  -d '{"prompt": "What is AI?"}'
```
