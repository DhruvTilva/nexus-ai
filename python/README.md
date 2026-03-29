# NexusAI Python — AI/ML Pipeline

3 Python tools built on top of the NexusAI API.
Zero changes to the Node.js backend. Just call the live API.

---

## Setup (one time)

```bash
cd nexus-ai/python
pip install -r requirements.txt
```

> First run downloads the embedding model (~90MB). After that it's instant.

---

## Tool 1 — RAG Pipeline

**What is RAG? (simple version)**
> Normal AI: You ask a question → AI answers from its training data
> RAG AI: You give it YOUR document → AI answers from YOUR document

```
Your PDF/text file
      ↓
Split into chunks (pieces of text)
      ↓
Each chunk → converted to numbers (vector/embedding)
      ↓
Stored in FAISS (a fast search database)
      ↓
You ask a question → find most relevant chunks → send to AI → get answer
```

**Run:**
```bash
cd rag
python rag_pipeline.py
```

**Try asking:**
- `What providers does NexusAI support?`
- `How does caching work?`
- `What is the daily limit for Groq?`

**Use your own document:**
```bash
python rag_pipeline.py path/to/your/file.txt
python rag_pipeline.py path/to/your/file.pdf
```

**What to say in interview:**
> "I built a RAG pipeline that chunks documents, embeds them using sentence-transformers,
> stores vectors in FAISS, retrieves the top-3 most relevant chunks for any query,
> and uses NexusAI as the LLM backbone to generate grounded answers."

---

## Tool 2 — Provider Benchmark

**What it does:**
> Sends the same 5 prompts to all 7 providers.
> Measures latency and success rate.
> Prints a table + saves a comparison chart as PNG.

**Run:**
```bash
cd benchmark
python benchmark.py
```

**Output:**
- Table showing each provider: success rate, avg latency, avg response length
- `benchmark_results.png` — bar charts comparing all providers

**What to say in interview:**
> "I built a benchmarking tool that systematically evaluates all providers across
> multiple prompts, measuring latency and reliability, and visualizes the results
> to make data-driven routing decisions."

---

## Tool 3 — Semantic Router

**What is semantic routing? (simple version)**
> Instead of always using the same provider, it reads your question,
> understands what TYPE of question it is, and picks the BEST provider for that type.

```
"Write a Python function..."  → detected: CODE     → sent to: groq (fastest)
"What is machine learning?"   → detected: FACTUAL  → sent to: gemini (most knowledgeable)
"Write a poem about..."       → detected: CREATIVE → sent to: openrouter (most creative)
"Solve this equation..."      → detected: MATH     → sent to: gemini (best reasoning)
```

**Run:**
```bash
cd semantic_router
python router.py
```

**Type `demo`** to see it classify 5 example prompts without calling the API.

**What to say in interview:**
> "I built a semantic router that uses sentence embeddings and FAISS vector search
> to classify incoming prompts into categories like code, math, creative, or factual,
> then routes each query to the most suitable provider based on its strengths."

---

## How They All Work Together

```
User query
    ↓
Semantic Router classifies it → picks best provider
    ↓
RAG Pipeline adds relevant context from your documents
    ↓
NexusAI API sends to the chosen provider
    ↓
Response returned

Benchmark tool measures and visualizes how well each provider performs.
```

---

## Key Concepts for Interview

| Concept | What it means simply |
|---------|---------------------|
| **Embedding** | Converting text into numbers so computers can compare meaning |
| **Vector** | A list of numbers that represents the meaning of text |
| **FAISS** | Facebook's fast search library — finds similar vectors in milliseconds |
| **Cosine similarity** | How similar two vectors are (1.0 = identical, 0.0 = unrelated) |
| **Chunking** | Splitting a document into small overlapping pieces |
| **RAG** | Retrieval Augmented Generation — AI answers from YOUR data |
| **Semantic routing** | Understanding query intent to pick the right tool/model |
| **Benchmarking** | Systematically measuring and comparing model performance |

---

## Files

```
python/
├── requirements.txt
├── README.md                         ← you are here
│
├── rag/
│   ├── rag_pipeline.py               ← main RAG script
│   └── sample_doc.txt                ← NexusAI documentation (for testing)
│
├── benchmark/
│   ├── benchmark.py                  ← benchmark all providers
│   └── benchmark_results.png         ← generated after running
│
└── semantic_router/
    └── router.py                     ← semantic query router
```
