const fetch = require('node-fetch');

module.exports = {
  name: 'ollama',
  displayName: 'Ollama (Self-hosted)',
  isEnabled: true,
  dailyLimit: 999999,
  requestsToday: 0,
  lastResetDate: new Date().toDateString(),

  async ask(prompt, options = {}) {
    this._resetIfNewDay();
    const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
    const timeout = options.timeout || parseInt(process.env.PROVIDER_TIMEOUT_MS) || 10000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(`${host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options.model || 'phi3:mini',
          prompt: prompt,
          stream: false,
          options: {
            num_predict: options.max_tokens || 1000,
            temperature: options.temperature || 0.7,
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Ollama ${res.status}: ${err}`);
      }

      const data = await res.json();
      if (!data.response) throw new Error('Empty response from Ollama');

      this.requestsToday++;
      return data.response;
    } finally {
      clearTimeout(timer);
    }
  },

  async checkHealth() {
    try {
      const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
      const res = await fetch(`${host}/api/tags`, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  },

  getQuotaRemaining() {
    return this.dailyLimit;
  },

  _resetIfNewDay() {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.requestsToday = 0;
      this.lastResetDate = today;
    }
  },
};
