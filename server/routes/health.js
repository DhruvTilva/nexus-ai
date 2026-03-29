const express = require('express');
const router = express.Router();
const { getAllProviders } = require('../config/providers');
const { isCacheEnabled } = require('../services/cache');

const startTime = Date.now();

router.get('/health', (req, res) => {
  const providers = getAllProviders();
  const activeCount = Object.values(providers).filter(p => p.isEnabled).length;
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  res.json({
    status: 'ok',
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`,
    providers_active: activeCount,
    cache_enabled: isCacheEnabled(),
    timestamp: new Date().toISOString(),
  });
});

router.get('/providers', (req, res) => {
  const providers = getAllProviders();
  const list = Object.values(providers).map(p => ({
    name: p.name,
    displayName: p.displayName,
    enabled: p.isEnabled,
    quota_remaining: p.getQuotaRemaining(),
    daily_limit: p.dailyLimit,
  }));
  res.json({ success: true, providers: list });
});

module.exports = router;
