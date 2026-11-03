import { dashboardFetch } from './dashboardFetch';
const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/metabolic-admin').replace(/\/metabolic-admin\/?$/, '').replace(/\/$/, '') + '/push';
async function request(path, method = 'GET', payload) {
  const response = await dashboardFetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json' }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || 'Could not complete notification request');
  return data;
}
export const notificationApi = {
  analytics: () => request('/analytics'), drafts: () => request('/drafts'),
  saveDraft: (body) => request('/drafts', 'POST', body), removeDraft: (id) => request(`/drafts/${id}`, 'DELETE'),
  stats: () => request('/stats'), history: (page = 1, filters = {}) => request(`/campaigns?${new URLSearchParams({ page, ...filters })}`),
  preview: (body) => request('/preview', 'POST', body), send: (body) => request('/send', 'POST', body),
  test: (body) => request('/test', 'POST', body),
  update: (id, body) => request(`/campaigns/${id}`, 'PATCH', body), cancel: (id) => request(`/campaigns/${id}/cancel`, 'POST', {}),
};
