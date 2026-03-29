"""
NexusAI Provider Benchmark
---------------------------
Tests all 7 providers with the same prompts.
Measures: latency (speed), success rate, response length.
Prints a comparison table + saves a bar chart.

Run:
  python benchmark.py
"""

import time
import requests
import statistics
import matplotlib
matplotlib.use("Agg")  # no display needed — saves to file
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from tabulate import tabulate
from colorama import Fore, Style, init

init(autoreset=True)

# ── Config ──────────────────────────────────────────────────────────────────
NEXUSAI_URL = "https://nexus-ai-tobh.onrender.com/ask"
API_KEY     = "dt-ask"

PROVIDERS = ["gemini", "groq", "huggingface", "cohere", "cloudflare", "openrouter"]
# Ollama skipped by default (needs VM running) — add "ollama" if your VM is up

TEST_PROMPTS = [
    "What is machine learning?",
    "Explain neural networks in one sentence.",
    "What is the difference between AI and ML?",
    "What is a large language model?",
    "Explain what an API is in simple terms.",
]
# ────────────────────────────────────────────────────────────────────────────


def call_provider(provider: str, prompt: str) -> dict:
    """
    Call one provider with one prompt.
    Returns: latency, success, response length, error if any.
    """
    start = time.time()
    try:
        res = requests.post(
            NEXUSAI_URL,
            headers={"Content-Type": "application/json", "x-api-key": API_KEY},
            json={"prompt": prompt, "provider": provider, "cache": False, "max_tokens": 150},
            timeout=30,
        )
        latency = round((time.time() - start) * 1000)  # ms
        data = res.json()

        if data.get("success"):
            return {
                "provider": provider,
                "prompt": prompt,
                "latency_ms": latency,
                "success": True,
                "response_len": len(data.get("response", "")),
                "error": None,
            }
        else:
            return {
                "provider": provider,
                "prompt": prompt,
                "latency_ms": latency,
                "success": False,
                "response_len": 0,
                "error": data.get("error", "Unknown")[:60],
            }
    except Exception as e:
        return {
            "provider": provider,
            "prompt": prompt,
            "latency_ms": round((time.time() - start) * 1000),
            "success": False,
            "response_len": 0,
            "error": str(e)[:60],
        }


def run_benchmark():
    print(Fore.GREEN + Style.BRIGHT + "\n=== NexusAI Provider Benchmark ===\n")
    print(Fore.YELLOW + f"Testing {len(PROVIDERS)} providers × {len(TEST_PROMPTS)} prompts = {len(PROVIDERS) * len(TEST_PROMPTS)} total calls\n")

    results = []
    total   = len(PROVIDERS) * len(TEST_PROMPTS)
    done    = 0

    for provider in PROVIDERS:
        print(Fore.CYAN + f"Testing: {provider}")
        for prompt in TEST_PROMPTS:
            result = call_provider(provider, prompt)
            results.append(result)
            done += 1

            status = Fore.GREEN + "OK" if result["success"] else Fore.RED + "FAIL"
            print(f"  [{done}/{total}] {status}" + Fore.WHITE + f" | {result['latency_ms']}ms | {prompt[:40]}")

            time.sleep(0.5)  # avoid rate limits
        print()

    return results


def summarize(results: list) -> list:
    """
    Aggregate results per provider:
    - avg latency
    - success rate %
    - avg response length
    """
    summary = {}

    for r in results:
        p = r["provider"]
        if p not in summary:
            summary[p] = {"latencies": [], "successes": [], "lengths": []}
        summary[p]["latencies"].append(r["latency_ms"])
        summary[p]["successes"].append(1 if r["success"] else 0)
        summary[p]["lengths"].append(r["response_len"])

    rows = []
    for provider, data in summary.items():
        success_rate = round(sum(data["successes"]) / len(data["successes"]) * 100)
        valid_latencies = [l for l, s in zip(data["latencies"], data["successes"]) if s]
        avg_latency = round(statistics.mean(valid_latencies)) if valid_latencies else 9999
        avg_length  = round(statistics.mean([l for l in data["lengths"] if l > 0])) if any(data["lengths"]) else 0

        rows.append({
            "Provider":       provider,
            "Success Rate":   f"{success_rate}%",
            "Avg Latency":    f"{avg_latency}ms",
            "Avg Resp Len":   f"{avg_length} chars",
            "_success_rate":  success_rate,
            "_avg_latency":   avg_latency,
        })

    # Sort by success rate desc, then latency asc
    rows.sort(key=lambda x: (-x["_success_rate"], x["_avg_latency"]))
    return rows


def print_table(summary: list):
    headers = ["Provider", "Success Rate", "Avg Latency", "Avg Resp Len"]
    table   = [[r[h] for h in headers] for r in summary]
    print(Fore.GREEN + Style.BRIGHT + "\n── Results ──────────────────────────────")
    print(tabulate(table, headers=headers, tablefmt="rounded_outline"))


def save_chart(summary: list):
    providers = [r["Provider"] for r in summary]
    latencies = [r["_avg_latency"] for r in summary]
    rates     = [r["_success_rate"] for r in summary]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
    fig.patch.set_facecolor("#1a1a2e")

    colors = ["#6c63ff" if r == 100 else "#e94560" if r < 50 else "#f5a623" for r in rates]

    # Chart 1: Latency
    bars1 = ax1.bar(providers, latencies, color=colors, edgecolor="#333", linewidth=0.5)
    ax1.set_title("Average Latency (ms)\nLower is better", color="white", fontsize=12, pad=10)
    ax1.set_facecolor("#16213e")
    ax1.tick_params(colors="white", rotation=20)
    ax1.spines[:].set_color("#444")
    ax1.yaxis.label.set_color("white")
    for bar, val in zip(bars1, latencies):
        ax1.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 20,
                 f"{val}ms", ha="center", va="bottom", color="white", fontsize=9)

    # Chart 2: Success Rate
    bars2 = ax2.bar(providers, rates, color=colors, edgecolor="#333", linewidth=0.5)
    ax2.set_title("Success Rate (%)\nHigher is better", color="white", fontsize=12, pad=10)
    ax2.set_ylim(0, 110)
    ax2.set_facecolor("#16213e")
    ax2.tick_params(colors="white", rotation=20)
    ax2.spines[:].set_color("#444")
    for bar, val in zip(bars2, rates):
        ax2.text(bar.get_x() + bar.get_width() / 2, val + 1,
                 f"{val}%", ha="center", va="bottom", color="white", fontsize=9)

    legend = [
        mpatches.Patch(color="#6c63ff", label="100% success"),
        mpatches.Patch(color="#f5a623", label="Partial success"),
        mpatches.Patch(color="#e94560", label="<50% success"),
    ]
    fig.legend(handles=legend, loc="lower center", ncol=3,
               facecolor="#1a1a2e", edgecolor="#444", labelcolor="white", fontsize=9)

    plt.suptitle("NexusAI — Provider Benchmark", color="white", fontsize=14, y=1.02)
    plt.tight_layout()

    out_path = "benchmark_results.png"
    plt.savefig(out_path, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    print(Fore.GREEN + f"\nChart saved: {out_path}")


def main():
    results = run_benchmark()
    summary = summarize(results)
    print_table(summary)

    print(Fore.CYAN + "\nGenerating chart...")
    save_chart(summary)

    # Winner
    best = summary[0]
    print(Fore.GREEN + Style.BRIGHT + f"\nBest provider: {best['Provider']} "
          f"({best['Success Rate']} success, {best['Avg Latency']} avg latency)\n")


if __name__ == "__main__":
    main()
