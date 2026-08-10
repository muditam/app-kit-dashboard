const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/metabolic-admin').replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || `Request failed (${response.status})`);
  return body;
}

export const api = {
  getProducts: () => request('/products'),
  getKits: () => request('/kits'),
  createKit: (kit) => request('/kits', { method: 'POST', body: JSON.stringify(kit) }),
  updateKit: (id, kit) => request(`/kits/${id}`, { method: 'PATCH', body: JSON.stringify(kit) }),
  setKitStatus: (id, active) => request(`/kits/${id}/status`, { method: 'PATCH', body: JSON.stringify({ active }) }),
  getQuizQuestions: () => request('/quiz-questions'),
  updateQuizQuestion: (id, question) => request(`/quiz-questions/${id}`, { method: 'PATCH', body: JSON.stringify(question) }),
};
