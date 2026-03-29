const rateLimit = require('express-rate-limit');

const askLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,             // 30 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Rate limit exceeded. Try again in a minute.', retry_after: 60 },
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Rate limit exceeded.' },
});

module.exports = { askLimiter, adminLimiter };
