import { dashboardFetch } from "./dashboardFetch";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/metabolic-admin').replace(/\/$/, '');
const revisions = new Map();

async function request(path, options = {}) {
  if (['PATCH', 'POST'].includes(options.method)) {
    const payload = JSON.parse(options.body || '{}');
    const resource = path.split('/').slice(0, 3).join('/');
    const expectedUpdatedAt = revisions.get(resource);
    if (options.method === 'PATCH' && !expectedUpdatedAt) throw new Error('Refresh this page before publishing to load the current version.');
    if (!window.confirm(`Publish these changes now?\n\n${JSON.stringify(payload, null, 2)}`)) throw new Error('Publication cancelled.');
    const changeReason = window.prompt('Reason for this configuration change:');
    if (!changeReason?.trim()) throw new Error('A change reason is required to publish.');
    options = { ...options, body: JSON.stringify({ ...payload, expectedUpdatedAt, changeReason: changeReason.trim(), publish: true }) };
  }
  const response = await dashboardFetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(response.status === 409 ? 'This configuration changed. Refresh the page and review your changes before publishing again.' : body.message || body.error || `Request failed (${response.status})`);
  for (const [key, prefix] of [['products', '/products'], ['kits', '/kits'], ['questions', '/quiz-questions'], ['rules', '/rules']]) {
    for (const item of body[key] || []) {
      if (item.updatedAt) revisions.set(`${prefix}/${item._id}`, item.updatedAt);
      if (key === 'kits' && item.conditionKey && item.updatedAt) {
        const journeyKey = `/kit-journeys/${item.conditionKey}`;
        if (!revisions.has(journeyKey) || item.updatedAt > revisions.get(journeyKey)) revisions.set(journeyKey, item.updatedAt);
      }
    }
  }
  for (const key of ['product', 'kit', 'question', 'rule']) if (body[key]?.updatedAt) revisions.set(path.split('/').slice(0, 3).join('/'), body[key].updatedAt);
  return body;
}

export const api = {
  getProducts: () => request('/products'),
  updateProductPricing: (id, quantityPrices) => request(`/products/${id}/pricing`, { method: 'PATCH', body: JSON.stringify({ quantityPrices }) }),
  getKits: () => request('/kits'),
  createKit: (kit) => request('/kits', { method: 'POST', body: JSON.stringify(kit) }),
  updateKit: (id, kit) => request(`/kits/${id}`, { method: 'PATCH', body: JSON.stringify(kit) }),
  setKitStatus: (id, active) => request(`/kits/${id}/status`, { method: 'PATCH', body: JSON.stringify({ active }) }),
  updateKitJourney: (conditionKey, orderedKitIds) => request(`/kit-journeys/${conditionKey}`, { method: 'PATCH', body: JSON.stringify({ orderedKitIds }) }),
  getUserAssessments: (params = {}) => request(`/user-assessments?${new URLSearchParams(params).toString()}`),
  getUserAssessment: (phone) => request(`/user-assessments/${encodeURIComponent(phone)}`),
  getQuizQuestions: () => request('/quiz-questions'),
  updateQuizQuestion: (id, question) => request(`/quiz-questions/${id}`, { method: 'PATCH', body: JSON.stringify(question) }),
  getRules: () => request('/rules'),
  createRule: (rule) => request('/rules', { method: 'POST', body: JSON.stringify(rule) }),
  updateRule: (id, rule) => request(`/rules/${id}`, { method: 'PATCH', body: JSON.stringify(rule) }),
  getAIUsage: (period = 'month') => request(`/ai-usage?period=${encodeURIComponent(period)}`),
  getAIChatMembers: (params = {}) => request(`/ai-chat-members?${new URLSearchParams(params).toString()}`),
  getAIChatMember: (patientId) => request(`/ai-chat-members/${encodeURIComponent(patientId)}`),
  getAIChatMessages: (conversationId) => request(`/ai-chat-conversations/${encodeURIComponent(conversationId)}/messages`),
};
