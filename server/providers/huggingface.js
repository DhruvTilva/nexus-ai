const fetch = require('node-fetch');

module.exports = {
  name: 'huggingface',
  displayName: 'HuggingFace',
  isEnabled: true,
  dailyLimit: 1000,
  requestsToday: 0,
  lastResetDate: new Date().toDateString(),

  async ask(prompt, options = {}) {
    this._resetIfNewDay();
    const key = process.env.HUGGINGFACE_API_KEY;
    if (!key) throw new Error('HUGGINGFACE_API_KEY not set');

    const model = options.model || 'mistralai/Mistral-7B-Instruct-v0.3';
    const timeout = options.timeout || parseInt(process.env.PROVIDER_TIMEOUT_MS) || 5000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: options.max_tokens || 500,
            temperature: options.temperature || 0.7,
            return_full_text: false,
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`HuggingFace ${res.status}: ${err}`);
      }

      const data = await res.json();
      let text;
      if (Array.isArray(data) && data[0]?.generated_text) {
        text = data[0].generated_text;
      } else if (data.generated_text) {
        text = data.generated_text;
      } else {
        throw new Error('Unexpected HuggingFace response format');
      }

      this.requestsToday++;
      return text.trim();
    } finally {
      clearTimeout(timer);
    }
  },

  async checkHealth() {
    try {
      await this.ask('ping', { timeout: 8000, max_tokens: 10 });
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
