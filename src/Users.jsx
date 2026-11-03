import { useEffect, useState } from 'react';
import { dashboardFetch } from './dashboardFetch';
import './users.css';
const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/metabolic-admin').replace(/\/metabolic-admin\/?$/, '').replace(/\/$/, '') + '/admin/users';
const label = (key) => key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (s) => s.toUpperCase());
const hiddenSections = new Set(['program', 'guarantee', 'deletion', 'routine', 'bookings']);
const name = (user) => user.fullName || user.name || 'Unnamed user';
const date = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
async function request(path, signal) {
  const res = await dashboardFetch(base + path, { signal, cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'Could not load users');
  return data;
}
function Fields({ value }) {
  if (value === null || value === undefined || value === '') return <span className="users-muted">Not provided</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (Array.isArray(value)) return value.length ? <div className="users-values">{value.map((item, i) => <div key={i}><Fields value={item}/></div>)}</div> : <span className="users-muted">None</span>;
  if (typeof value === 'object') return <dl className="users-fields">{Object.entries(value).filter(([k]) => !['_id', '__v', 'userId', 'patientId'].includes(k)).map(([key, item]) => <div key={key}><dt>{label(key)}</dt><dd><Fields value={item}/></dd></div>)}</dl>;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return <span>{new Date(value).toLocaleString('en-IN')}</span>;
  return <span>{String(value)}</span>;
}
function Pagination({ page, total, onChange, loading }) {
  const pages = Math.max(1, Math.ceil(total / 20));
  return <div className="users-pagination"><span>{total.toLocaleString('en-IN')} records · Page {page} of {pages}</span><div><button disabled={loading || page <= 1} onClick={() => onChange(page - 1)}>← Previous</button><button disabled={loading || page >= pages} onClick={() => onChange(page + 1)}>Next →</button></div></div>;
}
function Member({ id, onBack }) {
  const [detail, setDetail] = useState(null), [section, setSection] = useState('profile'), [page, setPage] = useState(1);
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0), [conversation, setConversation] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    const path = section === 'profile' ? `/${id}` : conversation ? `/${id}/conversations/${conversation}` : `/${id}/records/${section}?page=${page}`;
    request(conversation ? path + `?page=${page}` : path, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (section === 'profile') setDetail(result); else setData(result);
    }).catch((e) => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, section, page, retry, conversation]);
  function choose(key) { setSection(key); setPage(1); setConversation(null); }
  const user = detail?.user;
  return <div className="users-member">
    <button className="users-back" onClick={onBack}>← All users</button>
    {user && <><header className="users-profile-header"><div className="users-avatar">{name(user).slice(0, 1).toUpperCase()}</div><div><span className="eyebrow">MEMBER PROFILE</span><h2>{name(user)}</h2><p>{user.phone}{user.email ? ` · ${user.email}` : ''}</p></div><span className={`users-badge ${user.hasPurchased ? 'customer' : ''}`}>{user.hasPurchased ? 'Customer' : 'No verified purchase'}</span></header>
    <div className="users-summary"><div><span>Joined</span><strong>{date(user.createdAt)}</strong></div><div><span>Language</span><strong>{user.preferredLanguage || 'Not set'}</strong></div><div><span>Current kit</span><strong>{user.currentKitNumber || '—'}</strong></div><div><span>Push device</span><strong>{detail.pushRegistered ? 'Registered' : 'Not registered'}</strong></div></div></>}
    <div className="users-detail-layout"><nav className="users-sections" aria-label="User record sections"><button className={section === 'profile' ? 'active' : ''} onClick={() => choose('profile')}>Profile & account</button>{detail?.sections.filter((item) => !hiddenSections.has(item.key)).map((item) => <button key={item.key} className={section === item.key ? 'active' : ''} onClick={() => choose(item.key)}>{item.label}</button>)}</nav>
    <section className="users-records" aria-busy={loading}><header><div><span className="eyebrow">USER DETAILS</span><h3>{section === 'profile' ? 'Profile & account' : conversation ? 'Conversation messages' : detail?.sections.find((s) => s.key === section)?.label}</h3></div>{conversation && <button onClick={() => { setConversation(null); setPage(1); }}>← Conversations</button>}</header>
    {error ? <div className="users-error" role="alert">{error}<button onClick={() => setRetry((n) => n + 1)}>Retry</button></div> : loading ? <div className="users-empty" role="status">Loading user details…</div> : section === 'profile' ? <Fields value={user}/> : <>
      {!data?.records.length ? <div className="users-empty">No saved records in this section yet.</div> : data.records.map((record, index) => <details className="users-record" key={record._id || index} open={data.records.length === 1 || conversation ? true : undefined}><summary><span>{record.title || record.game || record.canonical?.displayName || record.date || record.startDate || (conversation ? label(record.role) : `Record ${(page - 1) * 20 + index + 1}`)}<small>{date(record.createdAt || record.loggedAt || record.effectiveAt || record.updatedAt)}</small></span>{record.status && <span className="users-badge">{record.status}</span>}</summary><Fields value={record}/>{section === 'chats' && !conversation && <button className="users-primary" onClick={() => { setConversation(record._id); setPage(1); }}>Read conversation →</button>}</details>)}
      {data && <Pagination page={page} total={data.total} loading={loading} onChange={setPage}/>}
    </>}
    </section></div>
  </div>;
}
export default function Users() {
  const [selected, setSelected] = useState(null), [search, setSearch] = useState(''), [query, setQuery] = useState(''), [purchase, setPurchase] = useState(''), [language, setLanguage] = useState('');
  const [page, setPage] = useState(1), [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    if (selected) return;
    const controller = new AbortController(); setLoading(true); setError('');
    request(`?${new URLSearchParams({ search: query, purchase, language, page })}`, controller.signal).then((result) => { if (!controller.signal.aborted) setData(result); }).catch((e) => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, purchase, language, page, retry, selected]);
  if (selected) return <div className="users-page"><Member key={selected} id={selected} onBack={() => setSelected(null)}/></div>;
  return <div className="users-page"><div className="users-directory"><header><div><span className="eyebrow">MEMBER DIRECTORY</span><h2>All users <span>{data?.total ?? '—'}</span></h2><p>Profiles, preferences and the details of their journey.</p></div></header>
    <div className="users-filters"><label>Search users<input type="search" placeholder="Name, phone or email" value={search} onChange={(e) => setSearch(e.target.value)}/></label><label>Purchase status<select value={purchase} onChange={(e) => { setPurchase(e.target.value); setPage(1); }}><option value="">All users</option><option value="yes">Purchased</option><option value="no">No verified purchase</option></select></label><label>Language<select value={language} onChange={(e) => { setLanguage(e.target.value); setPage(1); }}><option value="">All languages</option><option>English</option><option>Hindi</option></select></label></div>
    {error ? <div className="users-error" role="alert">{error}<button onClick={() => setRetry((n) => n + 1)}>Retry</button></div> : loading ? <div className="users-empty" role="status">Loading users…</div> : !data?.users.length ? <div className="users-empty">No users match your search.</div> : <div className="users-table"><table><thead><tr><th>User</th><th>Contact</th><th>Language</th><th>Purchase</th><th>Joined</th><th>Details</th></tr></thead><tbody>{data.users.map((user) => <tr key={user._id}><td><strong>{name(user)}</strong><small>{user.role || 'PATIENT'}</small></td><td>{user.phone}<small>{user.email || 'No email added'}</small></td><td>{user.preferredLanguage || '—'}</td><td><span className={`users-badge ${user.hasPurchased ? 'customer' : ''}`}>{user.hasPurchased ? 'Purchased' : 'Not purchased'}</span></td><td>{date(user.createdAt)}</td><td><button className="users-primary" aria-label={`View ${name(user)}`} onClick={() => setSelected(user._id)}>View profile →</button></td></tr>)}</tbody></table></div>}
    {data && <Pagination page={page} total={data.total} loading={loading} onChange={setPage}/>}
  </div></div>;
}
