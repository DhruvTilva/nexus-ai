const { getDB } = require('../db/sqlite');

function logRequest({ requestId, prompt, provider, cached, latencyMs, success, error, clientIp, apiKey }) {
  try {
    const db = getDB();
    db.prepare(`
      INSERT INTO request_logs (request_id, prompt, provider_used, cached, latency_ms, success, error_message, client_ip, api_key_used)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(requestId, prompt, provider, cached ? 1 : 0, latencyMs, success ? 1 : 0, error || null, clientIp, apiKey);

    // Update provider stats
    if (provider) {
      const today = new Date().toISOString().split('T')[0];
      db.prepare(`
        INSERT INTO provider_stats (provider, date, requests_made, requests_failed, avg_latency_ms, cache_hits)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(provider, date) DO UPDATE SET
          requests_made = requests_made + ?,
          requests_failed = requests_failed + ?,
          avg_latency_ms = (avg_latency_ms * requests_made + ?) / (requests_made + 1),
          cache_hits = cache_hits + ?
      `).run(
        provider, today,
        cached ? 0 : 1,
        success ? 0 : 1,
        latencyMs,
        cached ? 1 : 0,
        cached ? 0 : 1,
        success ? 0 : 1,
        latencyMs,
        cached ? 1 : 0
      );
    }
  } catch (err) {
    console.error('[Logger] Failed to log request:', err.message);
  }
}

function getLogs({ limit = 50, offset = 0, provider, cached, success, search, dateFrom, dateTo } = {}) {
  const db = getDB();
  let query = 'SELECT * FROM request_logs WHERE 1=1';
  const params = [];

  if (provider) { query += ' AND provider_used = ?'; params.push(provider); }
  if (cached !== undefined) { query += ' AND cached = ?'; params.push(cached ? 1 : 0); }
  if (success !== undefined) { query += ' AND success = ?'; params.push(success ? 1 : 0); }
  if (search) { query += ' AND prompt LIKE ?'; params.push(`%${search}%`); }
  if (dateFrom) { query += ' AND timestamp >= ?'; params.push(dateFrom); }
  if (dateTo) { query += ' AND timestamp <= ?'; params.push(dateTo); }

  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const total = db.prepare(countQuery).get(...params).total;

  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = db.prepare(query).all(...params);
  return { rows, total };
}

function getStats() {
  const db = getDB();
  const today = new Date().toISOString().split('T')[0];

  const totalToday = db.prepare('SELECT COUNT(*) as count FROM request_logs WHERE date(timestamp) = ?').get(today)?.count || 0;
  const cachedToday = db.prepare('SELECT COUNT(*) as count FROM request_logs WHERE date(timestamp) = ? AND cached = 1').get(today)?.count || 0;
  const failedToday = db.prepare('SELECT COUNT(*) as count FROM request_logs WHERE date(timestamp) = ? AND success = 0').get(today)?.count || 0;

  const cacheHitRate = totalToday > 0 ? Math.round((cachedToday / totalToday) * 100) : 0;

  const providerUsage = db.prepare(`
    SELECT provider_used as provider, COUNT(*) as count
    FROM request_logs WHERE date(timestamp) = ? AND cached = 0
    GROUP BY provider_used
  `).all(today);

  const hourlyRequests = db.prepare(`
    SELECT strftime('%H', timestamp) as hour, COUNT(*) as count
    FROM request_logs WHERE timestamp >= datetime('now', '-24 hours')
    GROUP BY hour ORDER BY hour
  `).all();

  const recentRequests = db.prepare('SELECT * FROM request_logs ORDER BY timestamp DESC LIMIT 10').all();

  return { totalToday, cachedToday, failedToday, cacheHitRate, providerUsage, hourlyRequests, recentRequests };
}

function exportLogsCSV(filters = {}) {
  const { rows } = getLogs({ ...filters, limit: 100000, offset: 0 });
  const headers = 'id,request_id,timestamp,prompt,provider_used,cached,latency_ms,success,error_message,client_ip\n';
  const csv = rows.map(r =>
    `${r.id},"${r.request_id}","${r.timestamp}","${(r.prompt || '').replace(/"/g, '""')}","${r.provider_used}",${r.cached},${r.latency_ms},${r.success},"${r.error_message || ''}","${r.client_ip || ''}"`
  ).join('\n');
  return headers + csv;
}

module.exports = { logRequest, getLogs, getStats, exportLogsCSV };
