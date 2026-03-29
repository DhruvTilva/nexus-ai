// API key authentication for /ask endpoint
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const allowedKeys = (process.env.ALLOWED_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);

  if (!allowedKeys.length) {
    // No keys configured = open access (for dev)
    return next();
  }

  if (!apiKey) {
    return res.status(401).json({ success: false, error: 'Missing x-api-key header' });
  }

  if (!allowedKeys.includes(apiKey)) {
    return res.status(401).json({ success: false, error: 'Invalid API key' });
  }

  next();
}

// Admin password authentication
function adminAuth(req, res, next) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return next(); // No password = open access

  const provided = req.headers['x-admin-password'] || req.query.password;
  if (!provided || provided !== password) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  next();
}

module.exports = { apiKeyAuth, adminAuth };
