import { useEffect, useState } from 'react';
import { getSession, hasDashboardAccess, redirectToLogin } from './auth';

export default function AuthGate({ children }) {
  const [state, setState] = useState({ status: 'checking', user: null });

  useEffect(() => {
    let mounted = true;
    getSession()
      .then((user) => {
        if (!mounted) return;
        if (!user) {
          setState({ status: 'redirecting', user: null });
          redirectToLogin();
          return;
        }
        setState({ status: hasDashboardAccess(user) ? 'allowed' : 'forbidden', user });
      })
      .catch(() => {
        if (!mounted) return;
        setState({ status: 'redirecting', user: null });
        redirectToLogin();
      });
    return () => { mounted = false; };
  }, []);

  if (state.status === 'allowed') return typeof children === 'function' ? children(state.user) : children;
  if (state.status === 'forbidden') {
    return (
      <main className="auth-page">
        <section className="auth-card" role="alert">
          <div className="auth-mark">M</div>
          <p className="eyebrow">ACCESS REQUIRED</p>
          <h1>App Dashboard is not enabled for this account.</h1>
          <p>Ask a superadmin to add App Dashboard access from the Admin access page.</p>
          <small>{state.user?.username || state.user?.name || 'Signed-in account'}</small>
        </section>
      </main>
    );
  }
  return (
    <main className="auth-page" aria-label="Checking session">
      <section className="auth-card compact">
        <div className="auth-mark pulse">M</div>
        <span>Checking secure session...</span>
      </section>
    </main>
  );
}
