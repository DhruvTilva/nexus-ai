const { getOrderedProviders, getProviderByName } = require('../config/providers');

// Health tracking: { providerName: { failures: 0, lastFailure: 0, unhealthyUntil: 0 } }
const healthState = {};

function getHealthState(name) {
  if (!healthState[name]) {
    healthState[name] = { failures: 0, lastFailure: 0, unhealthyUntil: 0 };
  }
  return healthState[name];
}

function isHealthy(name) {
  const state = getHealthState(name);
  if (state.unhealthyUntil && Date.now() < state.unhealthyUntil) {
    return false;
  }
  // Auto-recover after cooldown
  if (state.unhealthyUntil && Date.now() >= state.unhealthyUntil) {
    state.failures = 0;
    state.unhealthyUntil = 0;
  }
  return true;
}

function markFailure(name) {
  const state = getHealthState(name);
  state.failures++;
  state.lastFailure = Date.now();

  const maxFailures = 3;
  const cooldownMin = parseInt(process.env.HEALTH_COOLDOWN_MINUTES) || 5;

  if (state.failures >= maxFailures) {
    state.unhealthyUntil = Date.now() + (cooldownMin * 60 * 1000);
    console.warn(`[Router] ${name} marked unhealthy for ${cooldownMin} minutes`);
  }
}

function markSuccess(name) {
  const state = getHealthState(name);
  state.failures = 0;
  state.unhealthyUntil = 0;
}

async function route(prompt, options = {}) {
  // If specific provider requested
  if (options.provider && options.provider !== 'auto') {
    const provider = getProviderByName(options.provider);
    if (!provider) throw new Error(`Provider "${options.provider}" not found`);
    if (!provider.isEnabled) throw new Error(`Provider "${options.provider}" is disabled`);

    const start = Date.now();
    const response = await provider.ask(prompt, options);
    const latency = Date.now() - start;
    return { response, provider: provider.name, latency };
  }

  // Auto routing with fallback
  const providers = getOrderedProviders();
  const errors = [];

  for (const provider of providers) {
    if (!provider.isEnabled) continue;
    if (!isHealthy(provider.name)) continue;
    if (provider.getQuotaRemaining() <= 0) continue;

    try {
      const start = Date.now();
      const response = await provider.ask(prompt, options);
      const latency = Date.now() - start;
      markSuccess(provider.name);
      return { response, provider: provider.name, latency };
    } catch (err) {
      markFailure(provider.name);
      errors.push({ provider: provider.name, error: err.message });
      console.warn(`[Router] ${provider.name} failed: ${err.message}`);
      continue;
    }
  }

  throw new Error(`All providers exhausted. Errors: ${errors.map(e => `${e.provider}: ${e.error}`).join('; ')}`);
}

function getHealthStatus() {
  const result = {};
  for (const [name, state] of Object.entries(healthState)) {
    result[name] = {
      healthy: isHealthy(name),
      failures: state.failures,
      unhealthyUntil: state.unhealthyUntil ? new Date(state.unhealthyUntil).toISOString() : null,
    };
  }
  return result;
}

module.exports = { route, getHealthStatus, isHealthy, markFailure, markSuccess };
