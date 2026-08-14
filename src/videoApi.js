const ADMIN_API_BASE_URL = (import.meta.env.VITE_ADMIN_API_BASE_URL || 'http://localhost:3001/api/admin')
  .replace(/\/$/, '');
const VIDEO_API_BASE_URL = `${ADMIN_API_BASE_URL}/video-library`;

async function request(path, options = {}) {
  const response = await fetch(`${VIDEO_API_BASE_URL}${path}`, {
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

function putFile(url, file, requiredHeaders, onProgress) {
  return new Promise((resolve, reject) => {
    const upload = new XMLHttpRequest();
    upload.open('PUT', url, true);
    Object.entries(requiredHeaders || {}).forEach(([name, value]) => upload.setRequestHeader(name, value));
    upload.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    upload.onload = () => upload.status >= 200 && upload.status < 300
      ? resolve()
      : reject(new Error(`Wasabi upload failed (${upload.status}). Check bucket CORS.`));
    upload.onerror = () => reject(new Error('Wasabi upload failed. Check network access and bucket CORS.'));
    upload.send(file);
  });
}

export const videoApi = {
  getClasses: () => request('/classes'),
  createClass: (payload) => request('/classes', { method: 'POST', body: JSON.stringify(payload) }),
  createUpload: (videoClassId, payload) => request(`/classes/${videoClassId}/assets/uploads`, {
    method: 'POST', body: JSON.stringify(payload),
  }),
  uploadFile: putFile,
  completeUpload: (videoClassId, assetId, payload) => request(`/classes/${videoClassId}/assets/${assetId}/complete`, {
    method: 'POST', body: JSON.stringify(payload),
  }),
  publishClass: (videoClassId, assetId) => request(`/classes/${videoClassId}/publish`, {
    method: 'POST', body: JSON.stringify(assetId ? { assetId } : {}),
  }),
  archiveClass: (videoClassId) => request(`/classes/${videoClassId}/archive`, {
    method: 'POST', body: '{}',
  }),
};
