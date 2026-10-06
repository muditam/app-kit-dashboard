const ADMIN_API_BASE_URL = (import.meta.env.VITE_ADMIN_API_BASE_URL || 'http://localhost:3001/api/admin').replace(/\/$/, '');
const REEL_API_BASE_URL = `${ADMIN_API_BASE_URL}/reels`;

async function request(path, options = {}) {
  const response = await fetch(`${REEL_API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || `Request failed (${response.status})`);
  return body;
}

function uploadFile(url, file, _headers, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const upload = new XMLHttpRequest();
    const aborted = () => {
      const error = new Error('Upload cancelled');
      error.name = 'AbortError';
      reject(error);
    };
    if (signal?.aborted) return aborted();
    upload.open('POST', url, true);
    upload.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    upload.onload = () => upload.status >= 200 && upload.status < 300
      ? resolve()
      : reject(new Error(`Cloudflare Stream upload failed (${upload.status})`));
    upload.onerror = () => reject(new Error('Cloudflare Stream upload failed. Check the connection and try again.'));
    upload.onabort = aborted;
    signal?.addEventListener('abort', () => upload.abort(), { once: true });
    const body = new FormData();
    body.append('file', file, file.name);
    upload.send(body);
  });
}

export const reelApi = {
  list: (scope = 'library') => request(scope === 'trash' ? '?scope=trash' : ''),
  create: (payload, signal) => request('', { method: 'POST', body: JSON.stringify(payload), signal }),
  update: (reelId, payload) => request(`/${reelId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  createUpload: (reelId, payload, signal) => request(`/${reelId}/assets/uploads`, { method: 'POST', body: JSON.stringify(payload), signal }),
  uploadFile,
  completeUpload: (reelId, assetId, payload, signal) => request(`/${reelId}/assets/${assetId}/complete`, { method: 'POST', body: JSON.stringify(payload), signal }),
  cancelUpload: (reelId, assetId) => request(`/${reelId}/uploads/cancel`, { method: 'POST', body: JSON.stringify(assetId ? { assetId } : {}) }),
  trash: (reelId) => request(`/${reelId}/trash`, { method: 'POST', body: '{}' }),
  restore: (reelId) => request(`/${reelId}/restore`, { method: 'POST', body: '{}' }),
  publish: (reelId, assetId) => request(`/${reelId}/publish`, { method: 'POST', body: JSON.stringify(assetId ? { assetId } : {}) }),
  disable: (reelId) => request(`/${reelId}/disable`, { method: 'POST', body: '{}' }),
  enable: (reelId) => request(`/${reelId}/enable`, { method: 'POST', body: '{}' }),
  playback: (reelId) => request(`/${reelId}/playback`),
  analytics: (reelId, days = 30) => request(`/${reelId}/analytics?days=${days}`),
};
