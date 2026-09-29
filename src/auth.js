const DEFAULT_SHIPTRACK_API_URL = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? '/shiptrack-api' : 'http://localhost:4000';
const SHIPTRACK_API_URL = (import.meta.env.VITE_SHIPTRACK_API_URL || DEFAULT_SHIPTRACK_API_URL).replace(/\/$/, '');
const DEFAULT_LOGIN_URL = window.location.hostname.endsWith('60brands.com') ? 'https://login.60brands.com/login' : 'http://localhost:3000/login';
const LOGIN_URL = (import.meta.env.VITE_LOGIN_URL || DEFAULT_LOGIN_URL).replace(/\/$/, '');
const APPS_URL = (import.meta.env.VITE_APPS_URL || new URL('/apps', LOGIN_URL).toString()).replace(/\/$/, '');
const ADMIN_ACCESS_URL = (import.meta.env.VITE_ADMIN_ACCESS_URL || new URL('/admin-access', LOGIN_URL).toString()).replace(/\/$/, '');
const LOCAL_APP_DASHBOARD_URL = 'http://localhost:5173/';
const APP_DASHBOARD_URL = (import.meta.env.VITE_APP_DASHBOARD_URL || (['localhost', '127.0.0.1'].includes(window.location.hostname) ? LOCAL_APP_DASHBOARD_URL : 'https://app.60brands.com')).replace(/\/$/, '');
const SHIPTRACK_URL = (import.meta.env.VITE_SHIPTRACK_URL || new URL('/', LOGIN_URL).toString()).replace(/\/$/, '') || '/';
const TICKETING_URL = (import.meta.env.VITE_TICKETING_URL || new URL('/ticketing', LOGIN_URL).toString()).replace(/\/$/, '');
const FINANCE_URL = (import.meta.env.VITE_FINANCE_URL || new URL('/finance', LOGIN_URL).toString()).replace(/\/$/, '');
const SALES_URL = (import.meta.env.VITE_SALES_URL || (window.location.hostname.endsWith('60brands.com') ? 'https://sales.60brands.com' : new URL('/sales', LOGIN_URL).toString())).replace(/\/$/, '');
const HR_INCENTIVES_URL = (import.meta.env.VITE_HR_INCENTIVES_URL || new URL('/hr-incentives', LOGIN_URL).toString()).replace(/\/$/, '');
const CHAT_DASHBOARD_URL = (import.meta.env.VITE_CHAT_DASHBOARD_URL || 'https://muditam-app-dashboard.vercel.app/widget/dashboard').replace(/\/$/, '');
const REQUIRED_APPLICATION = 'app-dashboard';

export const applicationCatalog = [
  { id: 'shiptrack', label: 'ShipTrack', href: SHIPTRACK_URL, description: 'Orders, fulfilment, tracking, returns and courier operations.' },
  { id: 'ticketing', label: 'Ticketing', href: TICKETING_URL, description: 'Customer complaints, support queues and team performance.' },
  { id: 'finance', label: 'Finance', href: FINANCE_URL, description: 'Upload remittance sheets and reconcile COD settlements.' },
  { id: 'sales', label: 'Sales', href: SALES_URL, description: 'Acquisition, abandoned carts and sales team access.' },
  { id: 'hr-incentives', label: 'HR & Incentives', href: HR_INCENTIVES_URL, description: 'Review agent incentives, delivered revenue and RTO impact.' },
  { id: 'app-dashboard', label: 'App Dashboard', href: APP_DASHBOARD_URL, description: 'Manage app operations, kits, videos and member assessment tools.' },
  { id: 'chat-dashboard', label: 'Chat Dashboard', href: CHAT_DASHBOARD_URL, description: 'Open the customer chat workspace.' },
];

export const adminAccessApplication = {
  id: 'admin-access',
  label: 'Admin access',
  href: ADMIN_ACCESS_URL,
  description: 'Create admins and control which workspaces each admin can open.',
};

function loginUrl() {
  const returnTo = window.location.href;
  return `${LOGIN_URL}?returnTo=${encodeURIComponent(returnTo)}`;
}

export async function getSession() {
  const response = await fetch(`${SHIPTRACK_API_URL}/api/auth/session`, {
    credentials: 'include',
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) return null;
  return body.user || null;
}

export function hasDashboardAccess(user) {
  if (!user) return false;
  if (user.accountRole === 'superadmin') return true;
  return Array.isArray(user.applications) && user.applications.includes(REQUIRED_APPLICATION);
}

export function redirectToLogin() {
  window.location.replace(loginUrl());
}

export function redirectToPlainLogin() {
  window.location.replace(LOGIN_URL);
}

export async function logout() {
  await fetch(`${SHIPTRACK_API_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => undefined);
  redirectToPlainLogin();
}
