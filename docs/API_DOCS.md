# API Documentation

## Base URL
```
http://localhost:3000
```

## Authentication
All `/ask` requests require an API key in the header:
```
x-api-key: your-api-key
```

---

## POST /ask — Main AI Endpoint

### Request
```json
{
  "prompt": "What is machine learning?",
  "provider": "auto",
  "max_tokens": 1000,
  "temperature": 0.7,
  "cache": true
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| prompt | string | Yes | — | Your question/prompt |
| provider | string | No | "auto" | "auto", "gemini", "groq", "huggingface", "cohere", "cloudflare", "openrouter", "ollama" |
| max_tokens | number | No | 1000 | Maximum response length |
| temperature | number | No | 0.7 | Creativity (0-1) |
| cache | boolean | No | true | Use cache |

### Success Response (200)
```json
{
  "success": true,
  "response": "Machine learning is...",
  "provider": "gemini",
  "cached": false,
  "latency_ms": 1200,
  "request_id": "req_abc123",
  "remaining_quota": { "gemini": 1420, "groq": 14000 }
}
```

### Error Response (503)
```json
{
  "success": false,
  "error": "All providers exhausted",
  "request_id": "req_abc123",
  "retry_after": 30
}
```

---

## GET /health
Returns server status.

## GET /providers
Returns list of available providers (no keys exposed).

---

## Code Examples

### JavaScript (fetch)
```javascript
const res = await fetch('http://localhost:3000/ask', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'mykey1'
  },
  body: JSON.stringify({ prompt: 'What is AI?' })
});
const data = await res.json();
console.log(data.response);
```

### Python (requests)
```python
import requests

res = requests.post('http://localhost:3000/ask',
    headers={'x-api-key': 'mykey1'},
    json={'prompt': 'What is AI?'}
)
print(res.json()['response'])
```

### cURL
```bash
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -H "x-api-key: mykey1" \
  -d '{"prompt": "What is AI?"}'
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad request — missing prompt |
| 401 | Invalid or missing API key |
| 429 | Rate limit exceeded |
| 503 | All providers failed |
