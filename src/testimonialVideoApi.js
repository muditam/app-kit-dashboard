const ADMIN_API_BASE_URL = (import.meta.env.VITE_ADMIN_API_BASE_URL || 'http://localhost:3001/api/admin').replace(/\/$/, '');
const BASE_URL = `${ADMIN_API_BASE_URL}/testimonial-videos`;

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `Request failed (${response.status})`);
  return data;
}

function uploadFile(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const upload = new XMLHttpRequest();
    upload.open('POST', url, true);
    upload.upload.onprogress = (event) => event.lengthComputable && onProgress?.(Math.round((event.loaded / event.total) * 100));
    upload.onload = () => upload.status >= 200 && upload.status < 300 ? resolve() : reject(new Error(`Cloudflare upload failed (${upload.status})`));
    upload.onerror = () => reject(new Error('Cloudflare upload failed. Check your connection and try again.'));
    const body = new FormData(); body.append('file', file, file.name); upload.send(body);
  });
}

export const testimonialVideoApi = {
  list: () => request(''),
  createUpload: (payload) => request('/uploads', { method: 'POST', body: JSON.stringify(payload) }),
  uploadFile,
  complete: (id, payload) => request(`/${id}/complete`, { method: 'POST', body: JSON.stringify(payload) }),
  publish: (id) => request(`/${id}/publish`, { method: 'POST', body: '{}' }),
  disable: (id) => request(`/${id}/disable`, { method: 'POST', body: '{}' }),
  enable: (id) => request(`/${id}/enable`, { method: 'POST', body: '{}' }),
  playback: (id) => request(`/${id}/playback`),
};
