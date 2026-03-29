const crypto = require('crypto');

// Filler words to remove for better cache matching
const FILLER_WORDS = new Set([
  'please', 'can', 'you', 'tell', 'me', 'hey', 'um', 'uh', 'like',
  'just', 'could', 'would', 'kindly', 'hi', 'hello', 'thanks', 'thank',
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'do', 'does', 'did',
  'i', 'my', 'we', 'our', 'about',
]);

function normalize(prompt) {
  let text = prompt
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, ' ')   // remove punctuation
    .replace(/\s+/g, ' ')       // collapse whitespace
    .trim();

  // Remove filler words
  const words = text.split(' ').filter(w => !FILLER_WORDS.has(w) && w.length > 0);

  // Sort for semantic matching
  words.sort();
  return words.join(' ');
}

function hashPrompt(prompt) {
  const normalized = normalize(prompt);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// Determine TTL based on prompt content
function getTTL(prompt) {
  const lower = prompt.toLowerCase();
  const factualTTL = parseInt(process.env.FACTUAL_CACHE_TTL_SECONDS) || 604800;
  const timeSensitiveTTL = parseInt(process.env.TIMESENSITIVE_CACHE_TTL_SECONDS) || 3600;
  const defaultTTL = parseInt(process.env.DEFAULT_CACHE_TTL_SECONDS) || 86400;

  // Time-sensitive queries
  if (/\b(today|current|latest|now|recent|this week|this month|this year|2025|2026)\b/.test(lower)) {
    return timeSensitiveTTL;
  }

  // Factual / definition queries
  if (/^(what is|define|explain|describe|who is|who was|how does|what are)\b/.test(lower)) {
    return factualTTL;
  }

  return defaultTTL;
}

module.exports = { normalize, hashPrompt, getTTL };
