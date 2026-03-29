const fetch = require('node-fetch');

module.exports = {
  name: 'cloudflare',
  displayName: 'Cloudflare Workers AI',
  isEnabled: true,
  dailyLimit: 10000,
  requestsToday: 0,
  lastResetDate: new Date().toDateString(),

  async ask(prompt, options = {}) {
    this._resetIfNewDay();
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token = process.env.CLOUDFLARE_API_TOKEN;
    if (!accountId || !token) throw new Error('Cloudflare credentials not set');

    const model = options.model || '@cf/meta/llama-3.1-8b-instruct';
    const timeout = options.timeout || parseInt(process.env.PROVIDER_TIMEOUT_MS) || 5000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            max_tokens: options.max_tokens || 1000,
          }),
          signal: controller.signal,
        }
      );

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Cloudflare ${res.status}: ${err}`);
      }

      const data = await res.json();
      const text = data.result?.response;
      if (!text) throw new Error('Empty response from Cloudflare');

      this.requestsToday++;
      return text;
    } finally {
      clearTimeout(timer);
    }
  },

  async checkHealth() {
    try {
      await this.ask('ping', { timeout: 5000, max_tokens: 10 });
      return true;
    } catch {
      return false;
    }
  },

  getQuotaRemaining() {
    this._resetIfNewDay();
    return this.dailyLimit - this.requestsToday;
  },

  _resetIfNewDay() {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.requestsToday = 0;
      this.lastResetDate = today;
    }
  },
};
