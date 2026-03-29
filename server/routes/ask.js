const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { apiKeyAuth } = require('../middleware/auth');
const { askLimiter } = require('../middleware/rateLimit');
const { route } = require('../services/router');
const { getFromCache, setToCache } = require('../services/cache');
const { deduplicate } = require('../services/deduplicator');
const { logRequest } = require('../services/logger');
const { getAllProviders } = require('../config/providers');

router.post('/ask', askLimiter, apiKeyAuth, async (req, res) => {
  const requestId = 'req_' + uuidv4().slice(0, 12);
  const startTime = Date.now();
  const { prompt, provider = 'auto', max_tokens, temperature, cache = true } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ success: false, error: 'Missing or empty "prompt" field', request_id: requestId });
  }

  try {
    // Check cache first
    if (cache) {
      const cached = await getFromCache(prompt);
      if (cached) {
        const latency = Date.now() - startTime;
        logRequest({
          requestId, prompt, provider: 'cache', cached: true,
          latencyMs: latency, success: true, clientIp: req.ip, apiKey: req.headers['x-api-key'],
        });

        return res.json({
          success: true,
          response: cached,
          provider: 'cache',
          cached: true,
          latency_ms: latency,
          request_id: requestId,
          remaining_quota: getQuotaSummary(),
        });
      }
    }

    // Deduplicate + route
    const result = await deduplicate(prompt, () =>
      route(prompt, { provider, max_tokens, temperature })
    );

    const latency = Date.now() - startTime;

    // Cache the result
    if (cache) {
      await setToCache(prompt, result.response);
    }

    logRequest({
      requestId, prompt, provider: result.provider, cached: false,
      latencyMs: latency, success: true, clientIp: req.ip, apiKey: req.headers['x-api-key'],
    });

    res.json({
      success: true,
      response: result.response,
      provider: result.provider,
      cached: false,
      latency_ms: latency,
      request_id: requestId,
      remaining_quota: getQuotaSummary(),
    });
  } catch (err) {
    const latency = Date.now() - startTime;
    logRequest({
      requestId, prompt, provider: null, cached: false,
      latencyMs: latency, success: false, error: err.message,
      clientIp: req.ip, apiKey: req.headers['x-api-key'],
    });

    res.status(503).json({
      success: false,
      error: err.message,
      request_id: requestId,
      retry_after: 30,
    });
  }
});

function getQuotaSummary() {
  const providers = getAllProviders();
  const summary = {};
  for (const [name, p] of Object.entries(providers)) {
    if (p.isEnabled) {
      summary[name] = p.getQuotaRemaining();
    }
  }
  return summary;
}

module.exports = router;
