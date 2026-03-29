// NexusAI Admin API Client
const API_BASE = window.location.origin;

function getAdminPassword() {
  return localStorage.getItem('nexusai_admin_password') || '';
}

function setAdminPassword(pwd) {
  localStorage.setItem('nexusai_admin_password', pwd);
}

async function api(path, options = {}) {
  const url = `${API_BASE}/admin${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'x-admin-password': getAdminPassword(),
    ...options.headers,
  };

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    showLoginModal();
    throw new Error('Unauthorized');
  }
  return res.json();
}

// Shortcuts
const adminAPI = {
  getStats: () => api('/stats'),
  getProviders: () => api('/providers'),
  updateProvider: (name, data) => api(`/providers/${name}`, { method: 'PUT', body: JSON.stringify(data) }),
  updatePriority: (priority) => api('/providers-priority', { method: 'PUT', body: JSON.stringify({ priority }) }),
  getLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api(`/logs?${qs}`);
  },
  getCacheStats: () => api('/cache/stats'),
  clearCache: () => api('/cache', { method: 'DELETE' }),
  getSettings: () => api('/settings'),
  playground: (data) => api('/playground', { method: 'POST', body: JSON.stringify(data) }),
  getHealth: () => api('/health'),
};
