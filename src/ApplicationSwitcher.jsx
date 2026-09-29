import { useEffect, useMemo, useState } from 'react';
import { adminAccessApplication, applicationCatalog } from './auth';

function AppIcon({ type }) {
  if (type === 'shiptrack') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5 12 3l8.5 4.5L12 12 3.5 7.5Z"/><path d="M3.5 7.5V17L12 21l8.5-4V7.5M12 12v9"/></svg>;
  if (type === 'ticketing') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v3a2.5 2.5 0 0 0 0 5v3A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-3a2.5 2.5 0 0 0 0-5v-3Z"/><path d="M12 7v2M12 12v5"/></svg>;
  if (type === 'finance') return <span aria-hidden="true">₹</span>;
  if (type === 'sales') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5M4 19h16"/><path d="m7 15 4-4 3 2 5-6"/><path d="M15 7h4v4"/></svg>;
  if (type === 'hr-incentives') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="3"/><path d="M3 19c.4-3.4 2.1-5 5-5s4.6 1.6 5 5M16 7h5M18.5 4.5v5M16 15h5M16 19h5"/></svg>;
  if (type === 'app-dashboard') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
  if (type === 'admin-access') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M3.5 19c.4-3.6 2.2-5.5 5.5-5.5s5.1 1.9 5.5 5.5"/><path d="M17.5 12.5v6M14.5 15.5h6"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5v-8Z"/><path d="M8 8h8M8 12h5"/></svg>;
}

export function visibleApplications(user) {
  if (!user) return [];
  if (user.accountRole === 'superadmin') return [...applicationCatalog, adminAccessApplication];
  const allowed = new Set(user.applications || []);
  return applicationCatalog.filter((application) => allowed.has(application.id));
}

export default function ApplicationSwitcher({ user, trigger }) {
  const [open, setOpen] = useState(false);
  const apps = useMemo(() => visibleApplications(user), [user]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);

  if (apps.length <= 1) return null;

  return (
    <>
      {trigger({ open: () => setOpen(true) })}
      {open && <div className="application-switch-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <section className="application-switch-modal" role="dialog" aria-modal="true" aria-labelledby="application-switch-title">
          <header><div><small>WORKSPACES</small><h2 id="application-switch-title">All applications</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close application switcher">×</button></header>
          <div className="application-switch-grid">
            {apps.map((application) => <a href={application.href} key={application.id}><i className={`switch-icon ${application.id}`}><AppIcon type={application.id}/></i><span>{application.label}</span><p>{application.description}</p><b>Open →</b></a>)}
          </div>
        </section>
      </div>}
    </>
  );
}
