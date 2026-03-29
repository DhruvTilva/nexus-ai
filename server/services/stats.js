/**
 * Redis-backed persistent stats & quota counters.
 * Survives server restarts and Render redeploys.
 *
 * Keys used in Redis:
 *   nexusai:stats:total:YYYY-MM-DD    → total requests that day
 *   nexusai:stats:cached:YYYY-MM-DD  → cached hits that day
 *   nexusai:stats:failed:YYYY-MM-DD  → failed requests that day
 *   nexusai:quota:PROVIDER:YYYY-MM-DD → provider requests used that day
 */

const { Redis } = require('@upstash/redis');

let redis = null;

function initStats() {
  const url   = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;
  if (url && token) {
    redis = new Redis({ url, token });
    console.log('[Stats] Redis stats tracker initialized');
  } else {
    console.warn('[Stats] No Redis config — stats will not persist across restarts');
  }
}

function todayDate() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD UTC
}

// ── Daily Stats (total / cached / failed) ───────────────────────────────────

async function incrDailyStat(type) {
  // type: 'total' | 'cached' | 'failed'
  if (!redis) return;
  try {
    const key = `nexusai:stats:${type}:${todayDate()}`;
    await redis.incr(key);
    await redis.expire(key, 8 * 24 * 3600); // keep 8 days
  } catch (e) {
    console.error('[Stats] incrDailyStat error:', e.message);
  }
}

async function getDailyStats(date) {
  // date: 'YYYY-MM-DD', defaults to today
  const d = date || todayDate();
  if (!redis) return { total: 0, cached: 0, failed: 0, fromRedis: false };
  try {
    const [total, cached, failed] = await Promise.all([
      redis.get(`nexusai:stats:total:${d}`),
      redis.get(`nexusai:stats:cached:${d}`),
      redis.get(`nexusai:stats:failed:${d}`),
    ]);
    return {
      total:     parseInt(total)  || 0,
      cached:    parseInt(cached) || 0,
      failed:    parseInt(failed) || 0,
      fromRedis: true,
    };
  } catch (e) {
    console.error('[Stats] getDailyStats error:', e.message);
    return { total: 0, cached: 0, failed: 0, fromRedis: false };
  }
}

// ── Provider Quota Counters ──────────────────────────────────────────────────

async function incrProviderQuota(providerName) {
  if (!redis) return;
  try {
    const key = `nexusai:quota:${providerName}:${todayDate()}`;
    await redis.incr(key);
    await redis.expire(key, 2 * 24 * 3600); // keep 2 days
  } catch (e) {
    console.error('[Stats] incrProviderQuota error:', e.message);
  }
}

async function getProviderQuota(providerName, date) {
  const d = date || todayDate();
  if (!redis) return 0;
  try {
    const val = await redis.get(`nexusai:quota:${providerName}:${d}`);
    return parseInt(val) || 0;
  } catch {
    return 0;
  }
}

async function getAllProviderQuotas(providerNames) {
  if (!redis) return {};
  const date = todayDate();
  const result = {};
  try {
    const values = await Promise.all(
      providerNames.map(n => redis.get(`nexusai:quota:${n}:${date}`))
    );
    providerNames.forEach((name, i) => {
      result[name] = parseInt(values[i]) || 0;
    });
  } catch (e) {
    console.error('[Stats] getAllProviderQuotas error:', e.message);
    providerNames.forEach(n => { result[n] = 0; });
  }
  return result;
}

module.exports = {
  initStats,
  incrDailyStat,
  getDailyStats,
  incrProviderQuota,
  getProviderQuota,
  getAllProviderQuotas,
};
