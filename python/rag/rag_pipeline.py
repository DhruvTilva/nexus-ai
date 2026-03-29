"""
NexusAI RAG Pipeline
--------------------
RAG = Retrieval Augmented Generation

Simple explanation:
  1. Read a document → split into small chunks
  2. Convert each chunk into a vector (list of numbers) using sentence-transformers
  3. Store all vectors in FAISS (a fast search database)
  4. When you ask a question → convert question to vector → find most similar chunks
  5. Send: question + relevant chunks → NexusAI API → get a smart answer

Run:
  python rag_pipeline.py
"""

import os
import sys
import requests
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
from colorama import Fore, Style, init

init(autoreset=True)

# ── Config ─────────────────────────────────────────────────────────────────
NEXUSAI_URL  = "https://nexus-ai-tobh.onrender.com/ask"
API_KEY      = "dt-ask"
EMBED_MODEL  = "all-MiniLM-L6-v2"   # small, fast, free — downloads ~90MB once
CHUNK_SIZE   = 150                   # characters per chunk (smaller = faster response)
CHUNK_OVERLAP = 20                   # overlap between chunks to avoid cutting context
TOP_K        = 2                     # how many chunks to retrieve (fewer = shorter prompt)
# ───────────────────────────────────────────────────────────────────────────


def load_document(path: str) -> str:
    """Load a .txt or .pdf file."""
    if path.endswith(".pdf"):
        try:
            import PyPDF2
            with open(path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                return "\n".join(page.extract_text() or "" for page in reader.pages)
        except ImportError:
            print(Fore.RED + "PyPDF2 not installed. Run: pip install PyPDF2")
            sys.exit(1)
    else:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list:
    """
    Split text into overlapping chunks.
    Example: "Hello world this is AI" with size=10, overlap=3
      → ["Hello worl", "orl this i", "his is AI"]
    Overlap ensures we don't cut a sentence in the middle.
    """
    chunks = []
    start = 0
    while start < len(text):
        end = start + size
        chunks.append(text[start:end].strip())
        start += size - overlap
    return [c for c in chunks if len(c) > 20]  # skip tiny chunks


def build_vector_store(chunks: list, model: SentenceTransformer):
    """
    Convert each chunk to a vector and store in FAISS.

    What is a vector?
      "The sky is blue" → [0.23, -0.51, 0.88, ...]  (384 numbers)
    Similar sentences → similar vectors → FAISS finds them fast.
    """
    print(Fore.CYAN + f"  Embedding {len(chunks)} chunks...")
    embeddings = model.encode(chunks, show_progress_bar=False)
    embeddings = np.array(embeddings, dtype="float32")

    # Normalize for cosine similarity
    faiss.normalize_L2(embeddings)

    # Build FAISS index (flat = exact search, good for small docs)
    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)  # IP = Inner Product (cosine after normalization)
    index.add(embeddings)

    return index, embeddings


def retrieve(query: str, index, chunks: list, model: SentenceTransformer, top_k: int = TOP_K) -> list:
    """
    Find the most relevant chunks for the query.
    Converts query to vector → searches FAISS → returns top_k most similar chunks.
    """
    query_vec = model.encode([query], show_progress_bar=False)
    query_vec = np.array(query_vec, dtype="float32")
    faiss.normalize_L2(query_vec)

    scores, indices = index.search(query_vec, top_k)

    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx >= 0:
            results.append({"chunk": chunks[idx], "score": float(score)})
    return results


def ask_nexusai(prompt: str) -> str:
    """Send prompt to NexusAI API and return the response text."""
    try:
        res = requests.post(
            NEXUSAI_URL,
            headers={"Content-Type": "application/json", "x-api-key": API_KEY},
            json={"prompt": prompt, "max_tokens": 500},
            timeout=30,
        )
        data = res.json()
        if data.get("success"):
            provider = data.get("provider", "unknown")
            latency  = data.get("latency_ms", 0)
            print(Fore.YELLOW + f"  [Provider: {provider} | Latency: {latency}ms]")
            return data["response"]
        else:
            return f"API Error: {data.get('error', 'Unknown error')}"
    except Exception as e:
        return f"Request failed: {e}"


def rag_answer(question: str, index, chunks: list, model: SentenceTransformer) -> str:
    """
    Full RAG cycle:
      1. Retrieve relevant chunks for the question
      2. Build a prompt: context + question
      3. Send to NexusAI → return answer
    """
    relevant = retrieve(question, index, chunks, model)

    context = "\n\n".join([f"[Chunk {i+1}]: {r['chunk']}" for i, r in enumerate(relevant)])

    prompt = f"""You are a helpful assistant. Answer the question using ONLY the context below.
If the answer is not in the context, say "I don't know based on the provided document."

Context:
{context}

Question: {question}

Answer:"""

    return ask_nexusai(prompt)


def main():
    print(Fore.GREEN + Style.BRIGHT + "\n=== NexusAI RAG Pipeline ===\n")

    # Step 1: Load document
    doc_path = os.path.join(os.path.dirname(__file__), "sample_doc.txt")
    if len(sys.argv) > 1:
        doc_path = sys.argv[1]

    print(Fore.CYAN + f"Loading document: {doc_path}")
    text = load_document(doc_path)
    print(Fore.GREEN + f"  Loaded {len(text)} characters")

    # Step 2: Chunk
    chunks = chunk_text(text)
    print(Fore.GREEN + f"  Split into {len(chunks)} chunks")

    # Step 3: Load embedding model (downloads ~90MB on first run)
    print(Fore.CYAN + f"\nLoading embedding model: {EMBED_MODEL}")
    print(Fore.YELLOW + "  (First run downloads ~90MB — one time only)")
    model = SentenceTransformer(EMBED_MODEL)
    print(Fore.GREEN + "  Model ready")

    # Step 4: Build vector store
    print(Fore.CYAN + "\nBuilding vector store (FAISS)...")
    index, _ = build_vector_store(chunks, model)
    print(Fore.GREEN + f"  FAISS index ready with {index.ntotal} vectors")

    # Step 5: Interactive Q&A loop
    print(Fore.GREEN + Style.BRIGHT + "\nRAG pipeline ready! Ask questions about your document.")
    print(Fore.YELLOW + "Type 'quit' to exit | Type 'load <path>' to load a different file\n")

    while True:
        try:
            question = input(Fore.WHITE + Style.BRIGHT + "Your question: ").strip()
        except (KeyboardInterrupt, EOFError):
            print(Fore.YELLOW + "\nExiting.")
            break

        if not question:
            continue
        if question.lower() == "quit":
            print(Fore.YELLOW + "Bye!")
            break
        if question.lower().startswith("load "):
            new_path = question[5:].strip()
            if os.path.exists(new_path):
                text   = load_document(new_path)
                chunks = chunk_text(text)
                index, _ = build_vector_store(chunks, model)
                print(Fore.GREEN + f"  Loaded new document: {len(chunks)} chunks, {index.ntotal} vectors")
            else:
                print(Fore.RED + f"  File not found: {new_path}")
            continue

        print(Fore.CYAN + "\nSearching relevant context...")
        relevant = retrieve(question, index, chunks, model)
        print(Fore.YELLOW + f"  Found {len(relevant)} relevant chunks (top scores: {[round(r['score'],2) for r in relevant]})")

        print(Fore.CYAN + "Asking NexusAI...")
        answer = rag_answer(question, index, chunks, model)

        print(Fore.GREEN + Style.BRIGHT + "\nAnswer:")
        print(Fore.WHITE + answer)
        print(Fore.YELLOW + "─" * 60 + "\n")


if __name__ == "__main__":
    main()
