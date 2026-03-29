const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimit');
const { getAllProviders, getProviderByName, providerMap, priorityOrder } = require('../config/providers');
const { getStats, getLogs, exportLogsCSV } = require('../services/logger');
const { getCacheStats, clearCache } = require('../services/cache');
const { getHealthStatus } = require('../services/router');
const { route } = require('../services/router');
const { getDB } = require('../db/sqlite');

// All admin routes require auth
router.use(adminLimiter);
router.use(adminAuth);

// Dashboard stats
router.get('/stats', (req, res) => {
  try {
    const stats = getStats();
    const health = getHealthStatus();
    const providers = getAllProviders();
    const activeCount = Object.values(providers).filter(p => p.isEnabled).length;

    res.json({
      success: true,
      ...stats,
      activeProviders: activeCount,
      healthStatus: health,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List providers
router.get('/providers', (req, res) => {
  const providers = getAllProviders();
  const health = getHealthStatus();
  const list = Object.values(providers).map(p => ({
    name: p.name,
    displayName: p.displayName,
    enabled: p.isEnabled,
    dailyLimit: p.dailyLimit,
    requestsToday: p.requestsToday,
    quotaRemaining: p.getQuotaRemaining(),
    health: health[p.name] || { healthy: true, failures: 0 },
  }));

  res.json({ success: true, providers: list, priority: require('../config/providers').priorityOrder });
});

// Update provider
router.put('/providers/:name', (req, res) => {
  const provider = getProviderByName(req.params.name);
  if (!provider) return res.status(404).json({ success: false, error: 'Provider not found' });

  const { enabled } = req.body;
  if (typeof enabled === 'boolean') {
    provider.isEnabled = enabled;

    // Persist enabled states
    const states = {};
    for (const [name, p] of Object.entries(providerMap)) {
      states[name] = p.isEnabled;
    }
    const db = getDB();
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('provider_enabled', JSON.stringify(states));
  }

  res.json({ success: true, provider: { name: provider.name, enabled: provider.isEnabled } });
});

// Update provider priority
router.put('/providers-priority', (req, res) => {
  const { priority } = req.body;
  if (!Array.isArray(priority)) return res.status(400).json({ success: false, error: 'priority must be an array' });

  const config = require('../config/providers');
  config.priorityOrder = priority;

  const db = getDB();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('provider_priority', JSON.stringify(priority));

  res.json({ success: true, priority });
});

// Logs
router.get('/logs', (req, res) => {
  const { limit = 50, offset = 0, provider, cached, success, search, dateFrom, dateTo } = req.query;
  const result = getLogs({
    limit: parseInt(limit),
    offset: parseInt(offset),
    provider,
    cached: cached === undefined ? undefined : cached === 'true',
    success: success === undefined ? undefined : success === 'true',
    search,
    dateFrom,
    dateTo,
  });
  res.json({ success: true, ...result });
});

// Export logs CSV
router.get('/logs/export', (req, res) => {
  const csv = exportLogsCSV(req.query);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=nexusai-logs.csv');
  res.send(csv);
});

// Cache stats
router.get('/cache/stats', async (req, res) => {
  const stats = await getCacheStats();
  res.json({ success: true, ...stats });
});

// Clear cache
router.delete('/cache', async (req, res) => {
  await clearCache();
  res.json({ success: true, message: 'Cache cleared' });
});

// Settings
router.get('/settings', (req, res) => {
  const config = require('../config/providers');
  res.json({
    success: true,
    settings: {
      providerPriority: config.priorityOrder,
      timeout: parseInt(process.env.PROVIDER_TIMEOUT_MS) || 5000,
      maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
      healthCooldown: parseInt(process.env.HEALTH_COOLDOWN_MINUTES) || 5,
      defaultCacheTTL: parseInt(process.env.DEFAULT_CACHE_TTL_SECONDS) || 86400,
      factualCacheTTL: parseInt(process.env.FACTUAL_CACHE_TTL_SECONDS) || 604800,
      timeSensitiveCacheTTL: parseInt(process.env.TIMESENSITIVE_CACHE_TTL_SECONDS) || 3600,
    },
  });
});

// Playground - test a prompt
router.post('/playground', async (req, res) => {
  const { prompt, provider = 'auto', max_tokens, temperature, skipCache } = req.body;
  if (!prompt) return res.status(400).json({ success: false, error: 'prompt is required' });

  try {
    const start = Date.now();
    const result = await route(prompt, { provider, max_tokens, temperature });
    const latency = Date.now() - start;
    res.json({ success: true, response: result.response, provider: result.provider, latency_ms: latency });
  } catch (err) {
    res.status(503).json({ success: false, error: err.message });
  }
});

// Health
router.get('/health', (req, res) => {
  const health = getHealthStatus();
  res.json({ success: true, health });
});

module.exports = router;
