# Deployment Guide — Free Hosting

## 1. Deploy Backend on Render.com (Free)

1. Push your code to GitHub
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. Settings:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. Add all environment variables from `.env` in Render's Environment tab
6. Deploy — your backend URL will be `https://your-app.onrender.com`

> Note: Free tier sleeps after 15 min of inactivity. First request after sleep takes ~30s.

## 2. Deploy Admin Panel on Vercel (Free)

1. Go to https://vercel.com → New Project
2. Import your GitHub repo
3. Settings:
   - **Root Directory:** `admin`
   - **Framework Preset:** Other
   - **Output Directory:** `.` (current directory)
4. Deploy

5. Update `API_BASE` in `admin/utils/api.js` to point to your Render backend URL:
```javascript
const API_BASE = 'https://your-app.onrender.com';
```

## 3. Setup Upstash Redis (Free)

Already covered in [SETUP.md](SETUP.md). Just add the credentials to Render's env vars.

## 4. Optional: Ollama on Oracle Cloud (Free VM)

1. Get a free Oracle Cloud account: https://cloud.oracle.com/free
2. Create an Always Free ARM instance (4 CPU, 24GB RAM)
3. SSH in and install Ollama:
```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull phi3:mini
```
4. Open port 11434 in security rules
5. Set `OLLAMA_HOST=http://your-vm-ip:11434` in Render env vars

## Cost Summary

| Service | Free Tier |
|---------|-----------|
| Render | 750 hours/month |
| Vercel | 100GB bandwidth |
| Upstash Redis | 10K commands/day |
| Gemini | 1,500 req/day |
| Groq | 14,400 req/day |
| Cloudflare AI | 10,000 neurons/day |
| HuggingFace | ~1,000 req/day |
| **Total** | **$0/month** |
