const { hashPrompt } = require('./normalizer');

// In-flight requests map: hash -> { promise, timestamp }
const inFlight = new Map();

// Cleanup old entries every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of inFlight) {
    if (now - entry.timestamp > 30000) {
      inFlight.delete(key);
    }
  }
}, 30000);

/**
 * Deduplicate identical requests.
 * If a request with the same normalized prompt is already in-flight,
 * return the same promise instead of making a new API call.
 */
function deduplicate(prompt, fetchFn) {
  const hash = hashPrompt(prompt);

  if (inFlight.has(hash)) {
    return inFlight.get(hash).promise;
  }

  const promise = fetchFn()
    .then(result => {
      // Remove from in-flight after a short delay (allow other waiting requests to resolve)
      setTimeout(() => inFlight.delete(hash), 2000);
      return result;
    })
    .catch(err => {
      inFlight.delete(hash);
      throw err;
    });

  inFlight.set(hash, { promise, timestamp: Date.now() });
  return promise;
}

module.exports = { deduplicate };
