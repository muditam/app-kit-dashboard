import { useEffect, useMemo, useState } from 'react';
import { api } from './api';

const dateTime = (value) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
const title = (value) => String(value || '').replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()).trim();
const answerText = (value) => Array.isArray(value) ? value.join(', ') : value && typeof value === 'object' ? JSON.stringify(value) : value == null || value === '' ? 'Not answered' : String(value);

function ProductImage({ product }) {
  const [failed, setFailed] = useState(false);
  if (!product?.image || failed) return <div className="assessment-product-fallback">{product?.name?.slice(0, 1) || '?'}</div>;
  return <img className="assessment-product-image" src={product.image} alt="" onError={() => setFailed(true)} />;
}

export default function UserAssessments() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ assessments: [], total: 0, totalPages: 0 });
  const [selectedPhone, setSelectedPhone] = useState('');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const limit = 20;

  async function loadList(nextPage = page, nextSearch = search) {
    setLoading(true); setError('');
    try {
      const response = await api.getUserAssessments({ page: nextPage, limit, search: nextSearch });
      setList(response);
      if (!selectedPhone && response.assessments?.[0]) setSelectedPhone(response.assessments[0].phone);
      if (selectedPhone && !response.assessments.some((item) => item.phone === selectedPhone)) setSelectedPhone(response.assessments?.[0]?.phone || '');
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }

  async function loadDetail(phone) {
    if (!phone) { setDetail(null); return; }
    setDetailLoading(true); setError('');
    try { setDetail(await api.getUserAssessment(phone)); }
    catch (loadError) { setError(loadError.message); setDetail(null); }
    finally { setDetailLoading(false); }
  }

  useEffect(() => { if (selectedPhone) loadDetail(selectedPhone); }, [selectedPhone]);
  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); loadList(1, search); }, 280);
    return () => clearTimeout(timer);
  }, [search]);

  const questionMap = useMemo(() => new Map((detail?.questions || []).map((question) => [question.key, question])), [detail]);
  const answers = detail?.quiz?.answers || {};
  const answerRows = Object.entries(answers).filter(([key]) => !['profile', 'assessmentVersion'].includes(key));
  const kit = detail?.recommendation?.recommendation;
  const safety = detail?.recommendation?.safety;
  const guarded = safety?.blocked || safety?.doctorReferral || detail?.recommendation?.constraints?.unsatisfied;

  return <div className="users-page">
    <section className="users-hero"><div><span>MEMBER INTELLIGENCE / QUIZ OUTCOMES</span><h2>User assessments</h2><p>Search a member to understand their answers, decision path, active rules and recommended kit.</p></div><div className="users-hero-stat"><small>QUIZZES COMPLETED</small><strong>{list.total}</strong><span>Latest assessment per member</span></div></section>
    {error && <div className="error-banner"><strong>Could not load assessments.</strong><span>{error}</span><button onClick={() => loadList()}>Try again</button></div>}
    <section className="users-layout">
      <aside className="panel user-list-panel">
        <div className="user-list-heading"><div><small>MEMBER DIRECTORY</small><h3>Quiz participants</h3></div><span>{list.total}</span></div>
        <label className="search-box user-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or mobile..."/></label>
        <div className="user-list">{loading ? [...Array(6)].map((_, index) => <div className="user-skeleton" key={index}/>) : list.assessments.map((item) => <button key={item.id} className={`user-list-item ${selectedPhone === item.phone ? 'selected' : ''}`} onClick={() => setSelectedPhone(item.phone)}><div className="user-avatar">{item.user.name?.slice(0, 1).toUpperCase() || '?'}</div><div className="user-list-copy"><strong>{item.user.name}</strong><span>{item.phone}</span><small>Quiz · {dateTime(item.createdAt)}</small></div><b>›</b></button>)}{!loading && !list.assessments.length ? <div className="users-empty">No completed quizzes match your search.</div> : null}</div>
        <div className="user-pagination"><button disabled={page <= 1} onClick={() => { const next = page - 1; setPage(next); loadList(next); }}>←</button><span>Page {page} of {Math.max(1, list.totalPages)}</span><button disabled={page >= list.totalPages} onClick={() => { const next = page + 1; setPage(next); loadList(next); }}>→</button></div>
      </aside>
      <main className="panel user-detail-panel">
        {detailLoading ? <div className="detail-loading">Loading member assessment…</div> : !detail ? <div className="detail-placeholder"><span>◎</span><strong>Select a member</strong><p>Choose a quiz participant to see the full recommendation journey.</p></div> : <>
          <header className="user-detail-header"><div><div className="detail-kicker">MEMBER ASSESSMENT</div><h3>{detail.user.name}</h3><p>{detail.user.phone} · Completed {dateTime(detail.quiz.createdAt)}</p></div><div className="detail-profile-pills"><span>{detail.user.age ? `${detail.user.age} yrs` : 'Age —'}</span><span>{detail.user.gender || 'Gender —'}</span><span className={guarded ? 'guarded' : 'safe'}>{guarded ? 'Review needed' : 'Kit eligible'}</span></div></header>
          <section className="assessment-overview-grid"><div><small>DISEASE PATHWAY</small><strong>{kit?.condition || (detail.recommendation?.diseaseScores && Object.keys(detail.recommendation.diseaseScores).join(' + ')) || 'Needs review'}</strong></div><div><small>RECOMMENDED KIT</small><strong>{kit?.name || 'No kit selected'}</strong></div><div><small>DECISION SCORE</small><strong>{kit?.score != null ? kit.score : '—'}</strong></div></section>
          {guarded ? <div className="assessment-guard"><strong>Clinical or rule guard active</strong><span>{safety?.messages?.[0] || 'No kit currently satisfies all mandatory constraints. Review this member before recommending a pathway.'}</span></div> : null}
          <div className="detail-columns">
            <section className="detail-card"><div className="detail-card-title"><span>01</span><div><small>SAVED QUIZ RESPONSE</small><h4>What the member told us</h4></div></div><div className="answer-list">{answerRows.map(([key, value]) => <div className="answer-row" key={key}><div><strong>{questionMap.get(key)?.question || title(key)}</strong><small>{questionMap.get(key)?.section?.label || 'Assessment response'}</small></div><span>{answerText(value)}</span></div>)}</div></section>
            <section className="detail-card"><div className="detail-card-title"><span>02</span><div><small>WHY THIS PATHWAY</small><h4>Quiz findings</h4></div></div><div className="findings-list">{(detail.recommendation?.matchedSignals || []).slice(0, 8).map((signal, index) => <div className="finding-row" key={`${signal.questionKey}-${index}`}><i>{index + 1}</i><div><strong>{signal.diseaseLabel || 'Recommendation signal'}</strong><span>{signal.question || title(signal.questionKey)} · {signal.answerLabel}</span></div><b>+{signal.weight}</b></div>)}{!detail.recommendation?.matchedSignals?.length ? <p className="muted-copy">No weighted quiz signals were matched.</p> : null}</div><div className="disease-scores">{Object.entries(detail.recommendation?.diseaseScores || {}).map(([key, value]) => <span key={key}><b>{title(key)}</b><strong>{value}</strong></span>)}</div></section>
          </div>
          <section className="detail-card rules-card"><div className="detail-card-title"><span>03</span><div><small>DECISION ENGINE TRACE</small><h4>Rules applied</h4></div><em>{detail.recommendation?.firedRules?.length || 0} fired</em></div><div className="rules-applied">{(detail.recommendation?.firedRules || []).map((rule) => <div className={`applied-rule ${rule.type}`} key={rule.ruleId}><span>{rule.type}</span><div><strong>{rule.name}</strong><small>{rule.description}</small></div><b>P{rule.priority}</b></div>)}{!detail.recommendation?.firedRules?.length ? <p className="muted-copy">No additional rules fired. The kit was selected from weighted quiz routing.</p> : null}</div></section>
          {kit ? <section className="detail-card recommended-kit-card"><div className="detail-card-title"><span>04</span><div><small>RECOMMENDATION OUTPUT</small><h4>Suggested kit</h4></div><em>{kit.forced ? 'Forced by rule' : kit.fallback ? 'Fallback pathway' : 'Best match'}</em></div><div className="kit-output-header"><div><strong>{kit.name}</strong><span>{kit.condition} · Month {kit.monthNumber || kit.kitNumber || 1}</span></div><b>₹{Number(kit.price || 0).toLocaleString('en-IN')}</b></div><div className="kit-output-products">{(kit.products || []).map((item) => <div className="kit-output-product" key={item.product?._id || item.product?.slug}><ProductImage product={item.product}/><div><strong>{item.product?.name || 'Unnamed product'}</strong><span>Quantity · {item.quantity}</span></div></div>)}</div><p className="kit-output-note">This is the same kit currently produced by the quiz recommendation endpoint using the active routing and guard rules.</p></section> : null}
        </>}
      </main>
    </section>
  </div>;
}
