# NexusAI

**Your personal AI API gateway — one endpoint, 7 free providers, smart routing.**

NexusAI routes your `/ask` requests to free AI providers (Gemini, Groq, HuggingFace, Cohere, Cloudflare AI, OpenRouter, Ollama) with automatic fallback, caching, and deduplication. Total cost: $0.

## Quick Start

```bash
cd server
cp .env.example .env       # Add your API keys
npm install
npm start
```

Open `http://localhost:3000/admin-panel` for the dashboard.

## Features

- **7 Free AI Providers** with auto-fallback
- **Smart Routing** — priority-based with health tracking
- **Redis Caching** — same prompt = instant cached response
- **Request Deduplication** — 10 identical requests = 1 API call
- **Admin Dashboard** — stats, logs, provider management, playground
- **API Key Auth** — secure your endpoint

## API Usage

```bash
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -H "x-api-key: mykey1" \
  -d '{"prompt": "What is machine learning?"}'
```

## Docs

- [Setup Guide](docs/SETUP.md) — Get API keys + run locally
- [API Documentation](docs/API_DOCS.md) — Integrate into your apps
- [Deployment Guide](docs/DEPLOYMENT.md) — Deploy free on Render + Vercel
