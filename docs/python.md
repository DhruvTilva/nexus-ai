# NexusAI Python Pipeline — Full Guide

> How to demo all 3 tools + end-to-end explanation of how each works.
> Written simply — no jargon. Read this before your interview.

---

## Quick Setup (do this first)

```bash
cd C:\Users\Dhruv Tilva\Desktop\nexus-ai\python
pip install -r requirements.txt
```

First run takes 2-3 minutes (downloads embedding model ~90MB). After that it's instant.

---

---

# TOOL 1 — RAG Pipeline

## What is RAG? (Real Simple)

**Without RAG:**
```
You: "What is the refund policy?"
AI:  "I don't know — I wasn't trained on your company's policy."
```

**With RAG:**
```
You upload: company_policy.pdf
You: "What is the refund policy?"
AI reads your PDF, finds the relevant part, answers correctly.
```

RAG = Give the AI YOUR documents. It answers from your data, not from general training.

---

## End-to-End Cycle (step by step)

### Step 1 — Load Document
```
company_policy.pdf  →  read all text  →  one big string of text
```
Your file becomes raw text. Supports `.txt` and `.pdf`.

---

### Step 2 — Chunking (split into pieces)
```
"NexusAI supports 7 providers. The first is Gemini.
 Gemini has a daily limit of 1500 requests. Groq has..."

          ↓ split into chunks of 150 characters ↓

Chunk 1: "NexusAI supports 7 providers. The first is Gemini."
Chunk 2: "Gemini has a daily limit of 1500 requests. Groq has"
Chunk 3: "a daily limit of 14400 requests. All providers..."
```

**Why chunks?** AI has a token limit. You can't send a 100-page PDF at once.
**Why overlap?** So we don't cut a sentence in the middle. Each chunk shares a bit with the next.

---

### Step 3 — Embedding (convert text to numbers)

This is the core ML concept. Every chunk becomes a list of 384 numbers called a **vector**.

```
"NexusAI supports 7 providers"   →  [0.23, -0.51, 0.88, 0.12, ...]  (384 numbers)
"I love pizza and pasta"         →  [0.91, -0.02, 0.11, 0.77, ...]  (384 numbers)
```

**Key idea:** Similar meaning = similar numbers.
```
"Gemini API limit"  →  [0.45, 0.67, ...]
"Google quota"      →  [0.44, 0.65, ...]   ← very similar numbers!
"I love pizza"      →  [0.91, -0.02, ...]  ← very different numbers
```

The model used: `all-MiniLM-L6-v2` (from HuggingFace, free, 90MB, runs on your laptop)

---

### Step 4 — Store in FAISS (Vector Database)

FAISS = Facebook AI Similarity Search. A super fast database for vectors.

```
Chunk 1 vector  →  stored in FAISS
Chunk 2 vector  →  stored in FAISS
Chunk 3 vector  →  stored in FAISS
...all chunks stored...
```

FAISS can search millions of vectors in milliseconds.
It's like a normal database but instead of searching by name/ID, it searches by **meaning**.

---

### Step 5 — Search (Retrieval)

You ask: `"What is the daily limit for Groq?"`

```
Your question  →  converted to vector  →  [0.33, 0.71, ...]

FAISS searches:
  Chunk 1 similarity score: 0.45  ← not very relevant
  Chunk 2 similarity score: 0.82  ← very relevant!  "Groq daily limit..."
  Chunk 3 similarity score: 0.61  ← somewhat relevant

Top 2 chunks returned.
```

**Similarity score:** 1.0 = exact match, 0.0 = completely unrelated

---

### Step 6 — Build Prompt + Ask AI

```
Prompt sent to NexusAI:
─────────────────────────────────────────────
You are a helpful assistant. Answer using ONLY this context:

[Chunk 1]: Groq has a daily limit of 14400 requests per day...
[Chunk 2]: Each provider has a dailyLimit field that tracks...

Question: What is the daily limit for Groq?

Answer:
─────────────────────────────────────────────
```

AI reads context → answers: **"Groq has a daily limit of 14,400 requests per day."**

---

### Full Cycle Diagram

```
Your file (PDF/TXT)
      │
      ▼
  [Load Text]
      │
      ▼
  [Chunk Text]  → 50 chunks of 150 chars each
      │
      ▼
  [Embed Chunks]  → 50 vectors using sentence-transformers
      │
      ▼
  [Store in FAISS]  → vector database ready
      │
      ▼ (when you ask a question)
  [Embed Question]  → 1 vector
      │
      ▼
  [Search FAISS]  → top 2 most similar chunks
      │
      ▼
  [Build Prompt]  → question + context chunks
      │
      ▼
  [NexusAI API]  → sends to best available provider
      │
      ▼
  [Answer]  → grounded in YOUR document
```

---

## How to Demo (RAG)

```bash
cd python/rag
python rag_pipeline.py
```

**Good demo questions to ask:**
```
What providers does NexusAI support?
How does caching work in NexusAI?
What happens when a provider fails?
Who built NexusAI?
What is the admin panel URL?
```

**Load your own file:**
```bash
python rag_pipeline.py C:\path\to\your\document.txt
python rag_pipeline.py C:\path\to\report.pdf
```

**What the interviewer sees:**
- You load a document
- You ask a question
- It shows: chunk scores + which provider answered + the answer
- AI answers from YOUR document, not from general knowledge

---

---

# TOOL 2 — Provider Benchmark

## What is Benchmarking? (Real Simple)

Benchmarking = testing multiple options under the same conditions to compare them fairly.

```
Same 5 questions asked to all 7 providers → measure:
  - Did it answer? (success rate)
  - How fast? (latency in ms)
  - How long was the answer? (response length)
```

Like testing 5 different cars on the same road and measuring speed + fuel.

---

## End-to-End Cycle (step by step)

### Step 1 — Define Test Prompts
```python
TEST_PROMPTS = [
    "What is machine learning?",
    "Explain neural networks in one sentence.",
    "What is the difference between AI and ML?",
    ...
]
```
Same prompts sent to every provider. Fair comparison.

---

### Step 2 — Call Each Provider

For each provider × each prompt:
```
POST /ask
  body: { prompt: "...", provider: "groq", cache: false }

Record:
  - Did it succeed? (success: true/false)
  - How long did it take? (latency_ms)
  - How long was the response? (len of response text)
```

`cache: false` is important — forces a real API call every time, no cached results.

---

### Step 3 — Aggregate Results

```
groq results:
  Prompt 1: 450ms ✓
  Prompt 2: 520ms ✓
  Prompt 3: 480ms ✓
  Prompt 4: 510ms ✓
  Prompt 5: 490ms ✓

Average latency: 490ms
Success rate: 100%
```

---

### Step 4 — Print Table + Save Chart

```
╭────────────────┬──────────────┬─────────────┬──────────────╮
│ Provider       │ Success Rate │ Avg Latency │ Avg Resp Len │
├────────────────┼──────────────┼─────────────┼──────────────┤
│ groq           │ 100%         │ 490ms       │ 312 chars    │
│ gemini         │ 80%          │ 1200ms      │ 445 chars    │
│ cloudflare     │ 100%         │ 850ms       │ 280 chars    │
╰────────────────┴──────────────┴─────────────┴──────────────╯
```

Also saves `benchmark_results.png` — bar charts for visual comparison.

---

### Full Cycle Diagram

```
For each provider in [gemini, groq, huggingface, cohere, cloudflare, openrouter]:
    For each prompt in TEST_PROMPTS:
        │
        ▼
    POST /ask (provider=X, cache=false)
        │
        ▼
    Record: success, latency, response_length
        │
        ▼
    Wait 0.5s (avoid rate limits)

After all calls:
    │
    ▼
Aggregate per provider → avg latency, success rate
    │
    ▼
Print table (tabulate)
    │
    ▼
Save bar charts (matplotlib) → benchmark_results.png
```

---

## How to Demo (Benchmark)

```bash
cd python/benchmark
python benchmark.py
```

Takes ~3-5 minutes to run all tests.

**What the interviewer sees:**
- Live progress: each provider being tested in real time
- Final comparison table printed in terminal
- `benchmark_results.png` opens — 2 bar charts side by side

**What to point out:**
- "Groq is fastest because it uses custom inference hardware"
- "Some providers may fail if their free quota is exhausted"
- "This data drives my routing decisions — fast providers get higher priority"

---

---

# TOOL 3 — Semantic Router

## What is Semantic Routing? (Real Simple)

**Without semantic routing:**
```
Every prompt → always sent to groq (or whatever default)
```

**With semantic routing:**
```
"Write Python code to sort a list"   → CODE category    → groq (fastest for code)
"What is the speed of light?"        → FACTUAL category → gemini (most knowledgeable)
"Write a poem about mountains"       → CREATIVE category→ openrouter (most creative)
"Solve: x² + 5x + 6 = 0"           → MATH category    → gemini (best reasoning)
```

It reads the MEANING of your question and picks the RIGHT provider for that type.

---

## End-to-End Cycle (step by step)

### Step 1 — Define Routes

Each route has example prompts and a recommended provider:

```
ROUTE: "code"
  Examples: ["Write a Python function", "Fix this bug", "Explain this code"]
  Provider: groq  (reason: fastest latency for code iteration)

ROUTE: "creative"
  Examples: ["Write a poem", "Tell me a story", "Create a slogan"]
  Provider: openrouter  (reason: good at open-ended creative tasks)

ROUTE: "factual"
  Examples: ["What is ML?", "Who invented X?", "Define Y"]
  Provider: gemini  (reason: vast factual training data)
```

---

### Step 2 — Embed All Examples

All example prompts from all routes get converted to vectors:

```
"Write a Python function"  →  [0.23, 0.71, ...]  → labeled: code
"Fix this bug"             →  [0.25, 0.69, ...]  → labeled: code
"Write a poem about"       →  [0.81, -0.12, ...]  → labeled: creative
"What is ML?"              →  [0.44, 0.55, ...]  → labeled: factual
```

Stored in FAISS — 40+ example vectors total.

---

### Step 3 — Classify Incoming Query

You ask: `"Write a JavaScript class for a bank account"`

```
1. Convert to vector: [0.22, 0.70, ...]

2. Search FAISS for top 3 similar examples:
   "Write a Python function"  score: 0.89  → route: code
   "Fix this bug in my code"  score: 0.81  → route: code
   "Write a SQL query"        score: 0.76  → route: code

3. Vote count: code=3, creative=0, factual=0

4. Winner: CODE → send to groq
```

---

### Step 4 — Send to Best Provider

```
Query: "Write a JavaScript class for a bank account"
Route: code → provider: groq

POST /ask
  body: { prompt: "...", provider: "groq" }

Response returned.
```

---

### Full Cycle Diagram

```
[Startup]
  Load all route examples
  Convert examples to vectors
  Store in FAISS
        │
        ▼
[Query arrives] "Write a Python function..."
        │
        ▼
  Convert query to vector
        │
        ▼
  Search FAISS → find top 3 most similar examples
        │
        ▼
  Vote: which route do those examples belong to?
        │
        ▼
  Route = CODE (3 votes) → provider = groq
        │
        ▼
  POST /ask with provider=groq
        │
        ▼
  Return answer
```

---

## How to Demo (Semantic Router)

```bash
cd python/semantic_router
python router.py
```

**First type `demo`** — shows classification of 5 prompts WITHOUT calling the API.
Great for showing the routing logic quickly.

```
Prompt: Write a Python function to reverse a string
  → Route: CODE | Provider: groq | Confidence: 89%

Prompt: What is the derivative of x cubed?
  → Route: MATH | Provider: gemini | Confidence: 84%

Prompt: Write a short poem about artificial intelligence
  → Route: CREATIVE | Provider: openrouter | Confidence: 91%
```

**Then ask real questions** and it routes + gets actual answers.

---

---

# How All 3 Work Together

```
User query
    │
    ▼
[Semantic Router]
Classifies: "code? math? creative? factual?"
Picks best provider for that type
    │
    ▼
[RAG Pipeline]  (if you have a relevant document loaded)
Finds relevant context from your documents
Adds it to the prompt
    │
    ▼
[NexusAI API]
Sends to the chosen provider with the enriched prompt
    │
    ▼
Answer

[Benchmark]  (run separately)
Tests all providers to validate routing decisions
Proves which provider is actually fastest/most reliable
```

---

# Key Words to Know for Interview

| Word | What it means (simple) |
|------|------------------------|
| **Embedding** | Converting text into a list of numbers that represent its meaning |
| **Vector** | That list of numbers. 384 numbers for each piece of text |
| **FAISS** | Facebook's fast database for searching vectors |
| **Cosine Similarity** | A score (0 to 1) measuring how similar two vectors are |
| **Chunking** | Splitting a big document into small pieces |
| **Retrieval** | Finding the most relevant chunks for a question |
| **Augmented Generation** | Adding retrieved context to improve the AI's answer |
| **RAG** | Retrieval + Augmented + Generation = the full pipeline |
| **Semantic** | Based on meaning, not exact word match |
| **Routing** | Deciding which AI provider to use for a request |
| **Benchmarking** | Testing and measuring performance across options |
| **Inference** | Running an AI model to get a prediction/answer |
| **Sentence Transformer** | A model that converts sentences to embeddings |
| **Top-K** | Return the K most similar results (e.g., top 2 chunks) |

---

# What to Say in Interview

**About the whole project:**
> "I built a full AI pipeline. The backend is a Node.js API gateway with 7 free providers,
> smart health-based routing, Redis caching, and SQLite logging.
> On top of that I built 3 Python tools: a RAG pipeline for document Q&A using
> sentence-transformers and FAISS, a provider benchmark that measures latency and
> success rates across all providers, and a semantic router that classifies query intent
> using embeddings and routes to the optimal provider."

**About RAG:**
> "The RAG pipeline chunks documents, generates embeddings using sentence-transformers,
> stores them in a FAISS index, and retrieves the top-2 most relevant chunks at query time.
> Those chunks are injected into the prompt as context so the LLM answers from your data."

**About Semantic Router:**
> "The semantic router embeds example prompts for each category — code, math, creative,
> factual — builds a FAISS index, and at inference time classifies the query by finding
> its nearest neighbors. The winning category maps to a recommended provider."

**About Benchmark:**
> "The benchmark sends identical prompts to all providers, measures latency and success rate,
> and visualizes the comparison. This data validates the routing priority order."

---

*For file locations → see `CODEBASE_REFERENCE.md`*
*For run commands → see `python/README.md`*
