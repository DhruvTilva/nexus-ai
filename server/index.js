require('dotenv').config();
const express = require('express');
const path = require('path');
const { initDB } = require('./db/sqlite');
const { initProviders } = require('./config/providers');
const { initCache } = require('./services/cache');
const { initStats } = require('./services/stats');
const corsMiddleware = require('./middleware/cors');
const askRoutes = require('./routes/ask');
const adminRoutes = require('./routes/admin');
const healthRoutes = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(corsMiddleware);

// Serve admin panel
app.use('/admin-panel', express.static(path.join(__dirname, '..', 'admin')));

// Routes
app.use('/', healthRoutes);
app.use('/', askRoutes);
app.use('/admin', adminRoutes);

// Startup
async function start() {
  try {
    initDB();
    console.log('[DB] SQLite initialized');

    initCache();
    console.log('[Cache] Redis cache initialized');

    initStats();
    console.log('[Stats] Redis stats tracker initialized');

    await initProviders();
    console.log('[Providers] All providers loaded with Redis quota counts');

    app.listen(PORT, () => {
      console.log(`\n🚀 NexusAI running on http://localhost:${PORT}`);
      console.log(`📊 Admin panel: http://localhost:${PORT}/admin-panel`);
      console.log(`❤️  Health check: http://localhost:${PORT}/health\n`);
    });
  } catch (err) {
    console.error('Failed to start NexusAI:', err);
    process.exit(1);
  }
}

start();
