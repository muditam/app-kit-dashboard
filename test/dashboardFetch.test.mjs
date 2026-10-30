import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('dashboard requests attach a shared token and refresh once after rejection', async () => {
  const source = (await fs.readFile(new URL('../src/dashboardFetch.js', import.meta.url), 'utf8'))
    .replace("import { SHIPTRACK_API_URL, redirectToLogin } from './auth';", "const SHIPTRACK_API_URL = 'https://login.test'; const redirectToLogin = () => {};");
  const { dashboardFetch } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const originalFetch = globalThis.fetch;
  let tokens = 0;
  let rejectOnce = false;
  globalThis.fetch = async (url, options) => {
    if (url.includes('app-dashboard-token')) {
      assert.equal(options.credentials, 'include');
      tokens += 1;
      return Response.json({ token: `token-${tokens}`, expiresAt: Date.now() + 300000 });
    }
    assert.equal(options.headers.get('X-Dashboard-Token'), `token-${tokens}`);
    assert.equal(options.headers.get('Content-Type'), 'application/json');
    if (rejectOnce) { rejectOnce = false; return new Response('', { status: 401 }); }
    return Response.json({ ok: true });
  };
  try {
    const options = { headers: { 'Content-Type': 'application/json' } };
    await Promise.all([dashboardFetch('https://api.test/products', options), dashboardFetch('https://api.test/kits', options)]);
    assert.equal(tokens, 1);
    rejectOnce = true;
    assert.equal((await dashboardFetch('https://api.test/products', options)).status, 200);
    assert.equal(tokens, 2);
  } finally { globalThis.fetch = originalFetch; }
});
