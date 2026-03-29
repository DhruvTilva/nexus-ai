const fetch = require('node-fetch');

module.exports = {
  name: 'cohere',
  displayName: 'Cohere',
  isEnabled: true,
  dailyLimit: 1000,
  requestsToday: 0,
  lastResetDate: new Date().toDateString(),

  async ask(prompt, options = {}) {
    this._resetIfNewDay();
    const key = process.env.COHERE_API_KEY;
    if (!key) throw new Error('COHERE_API_KEY not set');

    const timeout = options.timeout || parseInt(process.env.PROVIDER_TIMEOUT_MS) || 5000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch('https://api.cohere.ai/v2/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: options.model || 'command-r-08-2024',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: options.max_tokens || 1000,
          temperature: options.temperature || 0.7,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Cohere ${res.status}: ${err}`);
      }

      const data = await res.json();
      const text = data.message?.content?.[0]?.text;
      if (!text) throw new Error('Empty response from Cohere');

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
