const ADMIN_API_BASE_URL = (import.meta.env.VITE_ADMIN_API_BASE_URL || 'http://localhost:3001/api/admin').replace(/\/$/, '');
const REEL_API_BASE_URL = `${ADMIN_API_BASE_URL}/reels`;

async function request(path, options = {}) {
  const response = await fetch(`${REEL_API_BASE_URL}${path}`, {
    ...options,
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

function uploadFile(url, file, headers, onProgress) {
  return new Promise((resolve, reject) => {
    const upload = new XMLHttpRequest();
    upload.open('PUT', url, true);
    Object.entries(headers || {}).forEach(([name, value]) => upload.setRequestHeader(name, value));
    upload.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    upload.onload = () => upload.status >= 200 && upload.status < 300
      ? resolve()
      : reject(new Error(`Wasabi reel upload failed (${upload.status})`));
    upload.onerror = () => reject(new Error('Wasabi reel upload failed. Check bucket CORS and connectivity.'));
    upload.send(file);
  });
}

export const reelApi = {
  list: () => request(''),
  create: (payload) => request('', { method: 'POST', body: JSON.stringify(payload) }),
  createUpload: (reelId, payload) => request(`/${reelId}/assets/uploads`, { method: 'POST', body: JSON.stringify(payload) }),
  uploadFile,
  completeUpload: (reelId, assetId, payload) => request(`/${reelId}/assets/${assetId}/complete`, { method: 'POST', body: JSON.stringify(payload) }),
  publish: (reelId, assetId) => request(`/${reelId}/publish`, { method: 'POST', body: JSON.stringify(assetId ? { assetId } : {}) }),
  disable: (reelId) => request(`/${reelId}/disable`, { method: 'POST', body: '{}' }),
  enable: (reelId) => request(`/${reelId}/enable`, { method: 'POST', body: '{}' }),
  playback: (reelId) => request(`/${reelId}/playback`),
  analytics: (reelId, days = 30) => request(`/${reelId}/analytics?days=${days}`),
};
