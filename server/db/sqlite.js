const Database = require('better-sqlite3');
const path = require('path');

let db;

function initDB() {
  db = new Database(path.join(__dirname, '..', 'nexusai.db'));
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS request_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      prompt TEXT,
      provider_used TEXT,
      cached BOOLEAN,
      latency_ms INTEGER,
      success BOOLEAN,
      error_message TEXT,
      client_ip TEXT,
      api_key_used TEXT
    );

    CREATE TABLE IF NOT EXISTS provider_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT,
      date DATE,
      requests_made INTEGER DEFAULT 0,
      requests_failed INTEGER DEFAULT 0,
      avg_latency_ms REAL DEFAULT 0,
      cache_hits INTEGER DEFAULT 0,
      UNIQUE(provider, date)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  return db;
}

function getDB() {
  if (!db) throw new Error('Database not initialized. Call initDB() first.');
  return db;
}

module.exports = { initDB, getDB };
