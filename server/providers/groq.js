const fetch = require('node-fetch');

module.exports = {
  name: 'groq',
  displayName: 'Groq',
  isEnabled: true,
  dailyLimit: 14400,
  requestsToday: 0,
  lastResetDate: new Date().toDateString(),

  async ask(prompt, options = {}) {
    this._resetIfNewDay();
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY not set');

    const timeout = options.timeout || parseInt(process.env.PROVIDER_TIMEOUT_MS) || 5000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: options.model || 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: options.max_tokens || 1000,
          temperature: options.temperature || 0.7,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Groq ${res.status}: ${err}`);
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('Empty response from Groq');

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
