const { Redis } = require('@upstash/redis');
const { hashPrompt, getTTL } = require('./normalizer');

let redis = null;

function initCache() {
  const url = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;

  if (url && token) {
    redis = new Redis({ url, token });
    console.log('[Cache] Upstash Redis connected');
  } else {
    console.warn('[Cache] No Redis config found — caching disabled');
  }
}

async function getFromCache(prompt) {
  if (!redis) return null;
  try {
    const key = 'ai:' + hashPrompt(prompt);
    const cached = await redis.get(key);
    return cached || null;
  } catch (err) {
    console.error('[Cache] Get error:', err.message);
    return null;
  }
}

async function setToCache(prompt, response) {
  if (!redis) return;
  try {
    const key = 'ai:' + hashPrompt(prompt);
    const ttl = getTTL(prompt);
    await redis.set(key, response, { ex: ttl });
  } catch (err) {
    console.error('[Cache] Set error:', err.message);
  }
}

async function clearCache() {
  if (!redis) return;
  try {
    await redis.flushdb();
  } catch (err) {
    console.error('[Cache] Clear error:', err.message);
  }
}

async function getCacheStats() {
  if (!redis) return { enabled: false, keys: 0 };
  try {
    const size = await redis.dbsize();
    return { enabled: true, keys: size };
  } catch {
    return { enabled: true, keys: 0, error: 'Could not fetch stats' };
  }
}

function isCacheEnabled() {
  return redis !== null;
}

module.exports = { initCache, getFromCache, setToCache, clearCache, getCacheStats, isCacheEnabled };
