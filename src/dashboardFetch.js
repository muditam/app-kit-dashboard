import { SHIPTRACK_API_URL, redirectToLogin } from './auth';

let cachedToken;
let pendingToken;

export function clearDashboardToken() { cachedToken = null; }

async function getToken() {
  if (cachedToken?.expiresAt > Date.now() + 30000) return cachedToken.token;
  if (!pendingToken) {
    pendingToken = (async () => {
      const response = await fetch(`${SHIPTRACK_API_URL}/api/auth/app-dashboard-token`, {
        method: 'POST', credentials: 'include', cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) redirectToLogin();
      if (!response.ok) throw new Error(data.message || data.error || 'Dashboard sign-in could not be verified.');
      if (!data.token || !Number.isFinite(data.expiresAt)) throw new Error('Invalid dashboard session response.');
      cachedToken = data;
      return data.token;
    })().finally(() => { pendingToken = null; });
  }
  return pendingToken;
}

export async function dashboardFetch(url, options = {}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const headers = new Headers(options.headers);
    headers.set('X-Dashboard-Token', await getToken());
    const response = await fetch(url, { ...options, headers });
    if (response.status !== 401 || attempt === 1) return response;
    clearDashboardToken();
  }
}
