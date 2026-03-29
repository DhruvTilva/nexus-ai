"""
NexusAI Semantic Router
-----------------------
Automatically picks the best AI provider based on WHAT you're asking.

How it works:
  1. You have categories: code, math, creative, factual, general
  2. Each category has example sentences
  3. When you ask something, it converts your question to a vector
  4. Finds which category it's most similar to
  5. Sends to the best provider for that category

Example:
  "Write a Python function to sort a list"  → category: CODE  → provider: groq
  "Write a poem about the ocean"            → category: CREATIVE → provider: openrouter
  "What is the speed of light?"             → category: FACTUAL  → provider: gemini

Run:
  python router.py
"""

import requests
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
from colorama import Fore, Style, init

init(autoreset=True)

# ── Config ───────────────────────────────────────────────────────────────────
NEXUSAI_URL = "https://nexus-ai-tobh.onrender.com/ask"
API_KEY     = "dt-ask"
EMBED_MODEL = "all-MiniLM-L6-v2"
# ─────────────────────────────────────────────────────────────────────────────


# ── Route Definitions ─────────────────────────────────────────────────────────
# Each category has:
#   - examples: sample prompts that belong to this category
#   - provider: which NexusAI provider is best for this type
#   - reason: why this provider is best (for interview explanation)

ROUTES = {
    "code": {
        "examples": [
            "Write a Python function",
            "Fix this bug in my code",
            "How do I implement a binary search tree?",
            "Write a JavaScript class",
            "Explain this code snippet",
            "Debug this error in my program",
            "Write a SQL query to find duplicates",
            "Create a REST API endpoint in Node.js",
        ],
        "provider": "groq",
        "reason": "Groq has fastest latency — important for code iteration",
        "color": Fore.CYAN,
    },
    "math": {
        "examples": [
            "Solve this equation",
            "What is the derivative of x squared?",
            "Calculate compound interest",
            "Explain matrix multiplication",
            "What is the probability of rolling two sixes?",
            "Prove that the square root of 2 is irrational",
            "What is the integral of sin x?",
        ],
        "provider": "gemini",
        "reason": "Gemini is strong at reasoning and mathematical problems",
        "color": Fore.YELLOW,
    },
    "creative": {
        "examples": [
            "Write a poem about",
            "Tell me a short story",
            "Create a product slogan",
            "Write a creative essay",
            "Suggest baby names",
            "Write a song lyrics",
            "Imagine a world where",
            "Create a fictional character",
        ],
        "provider": "openrouter",
        "reason": "OpenRouter free models are good at creative open-ended tasks",
        "color": Fore.MAGENTA,
    },
    "factual": {
        "examples": [
            "What is machine learning?",
            "Who invented the telephone?",
            "What is the capital of France?",
            "Explain quantum computing",
            "What is DNA?",
            "How does the internet work?",
            "What is the speed of light?",
            "Define artificial intelligence",
        ],
        "provider": "gemini",
        "reason": "Gemini is trained on vast factual knowledge",
        "color": Fore.GREEN,
    },
    "general": {
        "examples": [
            "What do you think about",
            "Help me decide between",
            "Give me advice on",
            "What should I do if",
            "Can you summarize",
            "Translate this to Spanish",
            "Is it a good idea to",
        ],
        "provider": "groq",
        "reason": "Groq handles general queries fast with good quality",
        "color": Fore.WHITE,
    },
}
# ─────────────────────────────────────────────────────────────────────────────


class SemanticRouter:
    def __init__(self, model_name: str = EMBED_MODEL):
        print(Fore.CYAN + f"Loading embedding model: {model_name}")
        print(Fore.YELLOW + "  (First run downloads ~90MB — one time only)")
        self.model = SentenceTransformer(model_name)

        self.route_names  = []
        self.all_examples = []
        self.example_to_route = []

        # Collect all examples with their route label
        for route_name, route_data in ROUTES.items():
            for example in route_data["examples"]:
                self.route_names.append(route_name)
                self.all_examples.append(example)
                self.example_to_route.append(route_name)

        # Embed all examples and build FAISS index
        print(Fore.CYAN + f"  Building route index ({len(self.all_examples)} examples)...")
        embeddings = self.model.encode(self.all_examples, show_progress_bar=False)
        embeddings = np.array(embeddings, dtype="float32")
        faiss.normalize_L2(embeddings)

        dim = embeddings.shape[1]
        self.index = faiss.IndexFlatIP(dim)
        self.index.add(embeddings)

        print(Fore.GREEN + "  Semantic router ready!\n")

    def classify(self, query: str, top_k: int = 3) -> dict:
        """
        Classify a query into a route category.
        Returns the best matching route and its confidence score.
        """
        query_vec = self.model.encode([query], show_progress_bar=False)
        query_vec = np.array(query_vec, dtype="float32")
        faiss.normalize_L2(query_vec)

        scores, indices = self.index.search(query_vec, top_k)

        # Count votes from top_k nearest examples
        vote_counts = {}
        vote_scores = {}
        for score, idx in zip(scores[0], indices[0]):
            route = self.example_to_route[idx]
            vote_counts[route] = vote_counts.get(route, 0) + 1
            vote_scores[route]  = max(vote_scores.get(route, 0), float(score))

        # Pick route with most votes, break ties by score
        best_route = max(vote_counts, key=lambda r: (vote_counts[r], vote_scores[r]))

        return {
            "route":      best_route,
            "provider":   ROUTES[best_route]["provider"],
            "reason":     ROUTES[best_route]["reason"],
            "confidence": round(vote_scores[best_route] * 100, 1),
            "color":      ROUTES[best_route]["color"],
        }

    def route_and_ask(self, query: str) -> str:
        """Classify query → pick provider → send to NexusAI → return answer."""
        classification = self.classify(query)

        route    = classification["route"]
        provider = classification["provider"]
        color    = classification["color"]
        reason   = classification["reason"]
        conf     = classification["confidence"]

        print(color + f"  Category: {route.upper()} (confidence: {conf}%)")
        print(Fore.YELLOW + f"  Provider: {provider} — {reason}")
        print(Fore.CYAN + "  Sending to NexusAI...\n")

        try:
            res = requests.post(
                NEXUSAI_URL,
                headers={"Content-Type": "application/json", "x-api-key": API_KEY},
                json={"prompt": query, "provider": provider, "max_tokens": 300},
                timeout=30,
            )
            data = res.json()
            if data.get("success"):
                actual_provider = data.get("provider", provider)
                latency         = data.get("latency_ms", 0)
                print(Fore.YELLOW + f"  [Actual provider: {actual_provider} | Latency: {latency}ms]")
                return data["response"]
            else:
                return f"Error: {data.get('error', 'Unknown')}"
        except Exception as e:
            return f"Request failed: {e}"


def main():
    print(Fore.GREEN + Style.BRIGHT + "\n=== NexusAI Semantic Router ===\n")
    print(Fore.WHITE + "Routes queries to the best provider based on what you ask.\n")

    print(Fore.CYAN + "Available routes:")
    for name, data in ROUTES.items():
        print(data["color"] + f"  {name.upper():12} → {data['provider']:12} | {data['reason']}")
    print()

    router = SemanticRouter()

    print(Fore.GREEN + Style.BRIGHT + "Ask anything — the router picks the best provider automatically.")
    print(Fore.YELLOW + "Type 'demo' to run demo prompts | Type 'quit' to exit\n")

    while True:
        try:
            query = input(Fore.WHITE + Style.BRIGHT + "Your question: ").strip()
        except (KeyboardInterrupt, EOFError):
            print(Fore.YELLOW + "\nExiting.")
            break

        if not query:
            continue

        if query.lower() == "quit":
            print(Fore.YELLOW + "Bye!")
            break

        if query.lower() == "demo":
            demo_prompts = [
                "Write a Python function to reverse a string",
                "What is the derivative of x cubed?",
                "Write a short poem about artificial intelligence",
                "What is machine learning?",
                "Help me decide between React and Vue",
            ]
            print(Fore.CYAN + "\nRunning demo prompts...\n")
            for p in demo_prompts:
                print(Fore.WHITE + Style.BRIGHT + f"Prompt: {p}")
                classification = router.classify(p)
                print(classification["color"] + f"  → Route: {classification['route'].upper()} | Provider: {classification['provider']} | Confidence: {classification['confidence']}%")
                print()
            continue

        print()
        answer = router.route_and_ask(query)
        print(Fore.GREEN + Style.BRIGHT + "Answer:")
        print(Fore.WHITE + answer)
        print(Fore.YELLOW + "─" * 60 + "\n")


if __name__ == "__main__":
    main()
