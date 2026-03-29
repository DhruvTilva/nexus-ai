const cors = require('cors');

const corsMiddleware = cors({
  origin: function (origin, callback) {
    // Allow all origins for now — configure via env if needed
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'x-admin-password', 'Authorization'],
  credentials: true,
});

module.exports = corsMiddleware;
