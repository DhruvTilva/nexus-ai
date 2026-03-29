# NexusAI — Keys, Links & Pending Setup

---

## Part 1 — All Environment Variables & Direct Links

> Open `server/.env` to update any key. On Render → go to **Environment** tab.

---

### Authentication

| Variable | Value | Notes |
|----------|-------|-------|
| `ALLOWED_API_KEYS` | `dt-ask,key2,key3` | Comma separated. Any string you want. Used in `x-api-key` header |
| `ADMIN_PASSWORD` | your password | Used to log into admin panel |

---

### Redis Cache

| Variable | Get it from | Direct Link |
|----------|------------|-------------|
| `UPSTASH_REDIS_URL` | Upstash Console → your DB → REST API section | https://console.upstash.com |
| `UPSTASH_REDIS_TOKEN` | Same page, token shown below the URL | https://console.upstash.com |

**Steps to find:**
1. Go to https://console.upstash.com
2. Click your Redis database
3. Scroll to **REST API** section
4. Copy `UPSTASH_REDIS_REST_URL` → paste as `UPSTASH_REDIS_URL`
5. Copy `UPSTASH_REDIS_REST_TOKEN` → paste as `UPSTASH_REDIS_TOKEN`

---

### Provider API Keys

---

#### GEMINI_API_KEY
- **Get it:** https://aistudio.google.com/app/apikey
- **Free limit:** 1,500 req/day · 15 req/min
- **Model used:** `gemini-2.0-flash`
- **Steps:**
  1. Go to https://aistudio.google.com/app/apikey
  2. Click **Create API Key**
  3. Select or create a Google Cloud project
  4. Copy the key

---

#### GROQ_API_KEY
- **Get it:** https://console.groq.com/keys
- **Free limit:** 14,400 req/day
- **Model used:** `llama-3.1-8b-instant`
- **Steps:**
  1. Go to https://console.groq.com/keys
  2. Click **Create API Key**
  3. Give it a name → Copy the key

---

#### HUGGINGFACE_API_KEY
- **Get it:** https://huggingface.co/settings/tokens
- **Free limit:** ~1,000 req/day
- **Model used:** `Qwen/Qwen2.5-7B-Instruct`
- **Endpoint:** `https://router.huggingface.co/v1/chat/completions`
- **Steps:**
  1. Go to https://huggingface.co/settings/tokens
  2. Click **New token**
  3. Type: **Read** is enough
  4. Copy the token

---

#### COHERE_API_KEY
- **Get it:** https://dashboard.cohere.com/api-keys
- **Free limit:** ~1,000 req/month (trial key)
- **Model used:** `command-r-08-2024`
- **Steps:**
  1. Go to https://dashboard.cohere.com/api-keys
  2. Click **New Trial Key**
  3. Copy the key

---

#### CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN
- **Get Account ID:** https://dash.cloudflare.com → right sidebar shows **Account ID**
- **Get Token:** https://dash.cloudflare.com/profile/api-tokens
- **Free limit:** 10,000 neurons/day
- **Model used:** `@cf/meta/llama-3.1-8b-instruct`
- **Steps for token:**
  1. Go to https://dash.cloudflare.com/profile/api-tokens
  2. Click **Create Token**
  3. Click **Create Custom Token**
  4. Permission: `Account` → `Workers AI` → `Read`
  5. Click **Continue to summary** → **Create Token**
  6. Copy the token

---

#### OPENROUTER_API_KEY
- **Get it:** https://openrouter.ai/keys
- **Free limit:** Varies (free models available, `$0` marked models)
- **Model used:** `meta-llama/llama-3.1-8b-instruct:free`
- **Steps:**
  1. Go to https://openrouter.ai/keys
  2. Sign up / log in
  3. Click **Create Key**
  4. Copy the key

---

#### OLLAMA_HOST (Self-hosted — See Part 2 for full setup)
- **Value:** `http://YOUR_VM_IP:11434`
- **Optional:** `OLLAMA_MODEL=llama3.1:8b` (default)
- **Free:** Unlimited — runs on your own VM

---

### Routing & Cache Config (Optional Tuning)

| Variable | Default | What it does |
|----------|---------|-------------|
| `PROVIDER_TIMEOUT_MS` | `5000` | ms before giving up on a provider |
| `HEALTH_COOLDOWN_MINUTES` | `5` | Minutes a failed provider stays skipped |
| `DEFAULT_CACHE_TTL_SECONDS` | `86400` | Cache TTL for normal prompts (1 day) |
| `FACTUAL_CACHE_TTL_SECONDS` | `604800` | Cache TTL for "what is / explain" prompts (7 days) |
| `TIMESENSITIVE_CACHE_TTL_SECONDS` | `3600` | Cache TTL for "today / latest / current" prompts (1 hour) |

---

### Where to Update Keys

**Local:**
```
server/.env
```

**Production (Render):**
1. Go to https://dashboard.render.com
2. Click your service → **Environment** tab
3. Edit the variable → **Save Changes**
4. Render auto-redeploys

---

## Part 2 — Ollama on Oracle Cloud Free VM (Pending Setup)

> Oracle Cloud Always Free gives you an ARM VM with **4 CPU + 24GB RAM** — perfect for running llama3.1:8b.

---

### Step 1 — Create Oracle Cloud Account

1. Go to https://www.oracle.com/cloud/free/
2. Sign up (requires credit card for verification — **not charged**)
3. Choose your home region (pick the closest one — **cannot change later**)

---

### Step 2 — Create the Free VM

1. Log in → go to **Compute → Instances → Create Instance**
2. Click **Change image** → select **Ubuntu 22.04** (Canonical)
3. Click **Change shape**:
   - Shape series: **Ampere** (ARM)
   - Shape: `VM.Standard.A1.Flex`
   - OCPU: **4** · RAM: **24 GB**
4. Under **Add SSH keys** → paste your public SSH key
   - Generate one if needed: `ssh-keygen -t ed25519` in terminal
5. Click **Create**
6. Wait ~2 minutes → note the **Public IP address**

---

### Step 3 — Connect to VM

```bash
ssh ubuntu@YOUR_VM_PUBLIC_IP
```

---

### Step 4 — Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Verify it installed:
```bash
ollama --version
```

---

### Step 5 — Pull llama3.1:8b Model

```bash
ollama pull llama3.1:8b
```

> This downloads ~4.7GB. Takes 3-5 minutes depending on VM network speed.

Test it works:
```bash
ollama run llama3.1:8b "Hello, are you working?"
```

---

### Step 6 — Allow External Access (Open Port 11434)

By default Ollama only listens on localhost. You need to:

**A) Set Ollama to listen on all interfaces:**
```bash
sudo systemctl edit ollama
```
Add this inside the file:
```
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
```
Save and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

**B) Open port in Oracle Cloud firewall:**
1. Go to Oracle Cloud Console → your VM → **Subnet** → **Security List**
2. Click **Add Ingress Rules**
3. Source CIDR: `0.0.0.0/0`
4. Destination Port: `11434`
5. Click **Add Ingress Rules**

**C) Open port in Ubuntu firewall:**
```bash
sudo iptables -I INPUT -p tcp --dport 11434 -j ACCEPT
sudo netfilter-persistent save
```

If `netfilter-persistent` not found:
```bash
sudo apt install iptables-persistent -y
sudo netfilter-persistent save
```

---

### Step 7 — Test from Outside

From your local machine or browser:
```
http://YOUR_VM_PUBLIC_IP:11434
```
Should return: `Ollama is running`

---

### Step 8 — Add to NexusAI

Update your Render environment variables:
```
OLLAMA_HOST=http://YOUR_VM_PUBLIC_IP:11434
OLLAMA_MODEL=llama3.1:8b
```

Render auto-redeploys. Test in Playground → select **Ollama**.

---

### Step 9 — Keep Ollama Running After Reboot

Ollama installs as a systemd service automatically. Verify:
```bash
sudo systemctl status ollama
sudo systemctl enable ollama   # auto-start on reboot
```

---

### Ollama Quick Commands (for reference)

```bash
ollama list                    # see installed models
ollama pull llama3.1:8b        # download model
ollama pull mistral            # alternative model
ollama rm llama3.1:8b          # remove a model
ollama run llama3.1:8b         # interactive chat in terminal
sudo systemctl restart ollama  # restart service
sudo systemctl status ollama   # check if running
journalctl -u ollama -f        # live logs
```

---

### Troubleshooting Ollama

| Problem | Fix |
|---------|-----|
| `connection refused` on port 11434 | Check `OLLAMA_HOST=0.0.0.0` is set and service restarted |
| Port open but no response | Check Oracle Cloud Security List ingress rule |
| Model slow / timeout | Increase `PROVIDER_TIMEOUT_MS=30000` in Render env vars |
| Out of memory | Use smaller model: `ollama pull phi3:mini` (2.3GB) |
| VM stopped | Oracle free VMs can be reclaimed if idle — log in and restart |

---

*For file locations and line numbers → see `CODEBASE_REFERENCE.md`*
*For architecture overview → see `ARCHITECTURE.md`*
