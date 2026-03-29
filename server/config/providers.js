const gemini = require('../providers/gemini');
const groq = require('../providers/groq');
const huggingface = require('../providers/huggingface');
const cohere = require('../providers/cohere');
const cloudflare = require('../providers/cloudflare');
const openrouter = require('../providers/openrouter');
const ollama = require('../providers/ollama');
const { getDB } = require('../db/sqlite');
const { getAllProviderQuotas } = require('../services/stats');

// Default priority order
const DEFAULT_PRIORITY = ['gemini', 'groq', 'cloudflare', 'huggingface', 'cohere', 'openrouter', 'ollama'];

const providerMap = {
  gemini,
  groq,
  huggingface,
  cohere,
  cloudflare,
  openrouter,
  ollama,
};

async function initProviders() {
  // Load saved priority from DB if exists
  const db = getDB();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('provider_priority');
  if (row) {
    try {
      const saved = JSON.parse(row.value);
      if (Array.isArray(saved)) {
        module.exports.priorityOrder = saved;
      }
    } catch (_) {}
  }

  // Load enabled/disabled states
  const enabledRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('provider_enabled');
  if (enabledRow) {
    try {
      const states = JSON.parse(enabledRow.value);
      for (const [name, enabled] of Object.entries(states)) {
        if (providerMap[name]) {
          providerMap[name].isEnabled = enabled;
        }
      }
    } catch (_) {}
  }

  // Load today's quota counts from Redis into memory
  // This ensures accurate counts survive restarts and redeploys
  try {
    const names = Object.keys(providerMap);
    const quotas = await getAllProviderQuotas(names);
    for (const [name, count] of Object.entries(quotas)) {
      if (providerMap[name]) {
        providerMap[name].requestsToday = count;
        providerMap[name].lastResetDate = new Date().toDateString();
      }
    }
    console.log('[Providers] Quota counts loaded from Redis:', quotas);
  } catch (e) {
    console.warn('[Providers] Could not load quotas from Redis:', e.message);
  }
}

function getProviderByName(name) {
  return providerMap[name] || null;
}

function getAllProviders() {
  return providerMap;
}

function getOrderedProviders() {
  const order = module.exports.priorityOrder;
  return order.map(name => providerMap[name]).filter(Boolean);
}

module.exports = {
  initProviders,
  getProviderByName,
  getAllProviders,
  getOrderedProviders,
  providerMap,
  priorityOrder: [...DEFAULT_PRIORITY],
  DEFAULT_PRIORITY,
};
