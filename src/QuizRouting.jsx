import { useEffect, useMemo, useState } from 'react';
import { api } from './api';

const DISEASES = ['diabetes', 'diabetes + liver', 'diabetes + kidney', 'diabetes + heart', 'diabetes + liver + kidney', 'diabetes + liver + heart', 'diabetes + kidney + heart', 'diabetes + liver + kidney + heart'];

const clone = (value) => JSON.parse(JSON.stringify(value));
const title = (value) => String(value || '').replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

function MiniIcon({ name, size = 18 }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    edit: <><path d="m4 16-.8 4.8L8 20l10.8-10.8a2.8 2.8 0 0 0-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/></>,
  };
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function QuizRouting({ onToast }) {
  const [questions, setQuestions] = useState([]);
  const [kits, setKits] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState(null);
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.getQuizQuestions();
      setQuestions(response.questions || []); setKits(response.kits || []);
      if (!selectedId && response.questions?.length) setSelectedId(response.questions[0]._id);
    } catch (error) { onToast(error.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { const selected = questions.find((question) => question._id === selectedId); setDraft(selected ? clone(selected) : null); }, [questions, selectedId]);

  const sections = useMemo(() => ['all', ...new Set(questions.map((question) => question.section?.label).filter(Boolean))], [questions]);
  const visible = useMemo(() => questions.filter((question) => {
    const matchesSearch = `${question.question} ${question.key}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (sectionFilter === 'all' || question.section?.label === sectionFilter);
  }), [questions, search, sectionFilter]);
  const kitsBySlug = useMemo(() => new Map(kits.map((kit) => [kit.slug, kit])), [kits]);
  const routingCount = questions.reduce((sum, question) => sum + (question.routing?.length || 0), 0);
  const activeQuestion = draft;
  const options = activeQuestion?.routing || [];
  const topRoute = options.slice().sort((left, right) => Number(right.weight || 0) - Number(left.weight || 0))[0];

  const updateDraft = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const updateRoute = (index, patch) => setDraft((current) => ({ ...current, routing: current.routing.map((route, routeIndex) => routeIndex === index ? { ...route, ...patch } : route) }));

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const response = await api.updateQuizQuestion(draft._id, {
        question: draft.question, why: draft.why, placeholder: draft.placeholder, required: draft.required,
        autoAdvance: draft.autoAdvance, exclusiveOption: draft.exclusiveOption, validation: draft.validation,
        routing: draft.routing, active: draft.active, order: draft.order, section: draft.section,
      });
      setQuestions((current) => current.map((question) => question._id === response.question._id ? response.question : question));
      onToast('Question routing saved');
    } catch (error) { onToast(error.message); }
    finally { setSaving(false); }
  };

  return <div className="quiz-routing-page">
    <section className="routing-summary">
      <div className="routing-summary-copy"><span className="eyebrow">ASSESSMENT INTELLIGENCE / KIT ROUTING</span><h2>Quiz & routing</h2><p>Shape how every answer moves a member toward the right disease pathway and monthly kit.</p></div>
      <div className="routing-legend"><span><i className="legend-dot plum"/>Question signal</span><span><i className="legend-dot gold"/>Kit influence</span><span><i className="legend-dot green"/>Live rule</span></div>
    </section>
    <section className="routing-metrics"><div className="routing-metric accent"><span>Questions live</span><strong>{questions.length}</strong><small>API-driven copy</small></div><div className="routing-metric"><span>Answer rules</span><strong>{routingCount}</strong><small>editable influences</small></div><div className="routing-metric"><span>Kit pathways</span><strong>{new Set(kits.map((kit) => kit.conditionKey)).size}</strong><small>disease combinations</small></div><div className="routing-metric"><span>Quiz version</span><strong>V1</strong><small>final-quiz-v1</small></div></section>

    <section className="routing-workspace">
      <aside className="routing-question-list panel">
        <div className="routing-panel-heading"><div><span className="step">01</span><div><h3>Question map</h3><small>Choose a question to edit its influence</small></div></div><span className="count-badge">{visible.length}</span></div>
        <label className="search-box"><MiniIcon name="search"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search questions..."/></label>
        <div className="routing-section-chips">{sections.map((section) => <button key={section} className={sectionFilter === section ? 'selected' : ''} onClick={() => setSectionFilter(section)}>{section === 'all' ? 'All' : section}</button>)}</div>
        <div className="question-list-scroll">{loading ? [...Array(6)].map((_, index) => <div className="skeleton question-skeleton" key={index}/>) : visible.map((question) => <button key={question._id} className={`question-list-item ${selectedId === question._id ? 'selected' : ''}`} onClick={() => setSelectedId(question._id)}><span className="question-order">{String(question.order).padStart(2, '0')}</span><span className="question-list-copy"><small>{question.section?.label} · {question.type.replace('_', ' ')}</small><strong>{question.question}</strong><em>{question.routing?.length || 0} answer signals</em></span><MiniIcon name="arrow" size={15}/></button>)}</div>
      </aside>

      <main className="routing-editor panel">
        {!activeQuestion ? <div className="routing-empty"><MiniIcon name="spark" size={30}/><h3>Select a question</h3><p>Every question has a routing signal you can tune.</p></div> : <>
          <div className="routing-editor-header"><div><span className="editor-mode">QUESTION {String(activeQuestion.order).padStart(2, '0')} · {activeQuestion.section?.label?.toUpperCase()}</span><h3>{activeQuestion.key}</h3><p>{activeQuestion.type.replace('_', ' ')} {activeQuestion.required ? '· Required' : '· Optional'} {activeQuestion.autoAdvance ? '· Auto-advances' : ''}</p></div><label className="status-control"><span>{activeQuestion.active ? 'Live' : 'Paused'}</span><input type="checkbox" checked={activeQuestion.active} onChange={(event) => updateDraft({ active: event.target.checked })}/><i/></label></div>
          <div className="routing-editor-body">
            <div className="routing-copy-card"><div className="routing-card-label"><span>QUESTION COPY</span><MiniIcon name="edit" size={14}/></div><input className="routing-question-input" value={activeQuestion.question} onChange={(event) => updateDraft({ question: event.target.value })}/><textarea className="routing-why-input" value={activeQuestion.why || ''} onChange={(event) => updateDraft({ why: event.target.value })} placeholder="Why this question matters..."/><div className="routing-toggles"><label><input type="checkbox" checked={activeQuestion.required !== false} onChange={(event) => updateDraft({ required: event.target.checked })}/><span/>Required question</label><label><input type="checkbox" checked={Boolean(activeQuestion.autoAdvance)} onChange={(event) => updateDraft({ autoAdvance: event.target.checked })}/><span/>Auto-advance after selection</label></div></div>
            <div className="influence-header"><div><span className="routing-card-label">ANSWER INFLUENCE</span><h3>Where should each answer lead?</h3><p>Weight stronger signals higher. The quiz engine adds these scores to find the best pathway.</p></div><div className="live-preview"><span>TOP SIGNAL</span><strong>{topRoute?.answerLabel || '—'}</strong><small>{topRoute ? `${topRoute.weight} pts · ${topRoute.diseaseLabel || 'Unassigned'}` : 'No routing rule'}</small></div></div>
            <div className="route-table"><div className="route-table-head"><span>ANSWER</span><span>MATCH RULE</span><span>DISEASE PATHWAY</span><span>KIT SLUG(S)</span><span>WEIGHT</span></div>{options.map((route, index) => <div className="route-row" key={`${route.answerLabel}-${index}`}><div className="answer-cell"><span className="answer-index">{index + 1}</span><input value={route.answerLabel || ''} onChange={(event) => updateRoute(index, { answerLabel: event.target.value, answerValue: event.target.value })}/></div><div className="rule-cell"><select value={route.matchType || 'exact'} onChange={(event) => { const matchType = event.target.value; updateRoute(index, { matchType, sourceField: route.sourceField || (activeQuestion.key === 'body' ? 'bmi' : activeQuestion.key), answerValue: matchType === 'range' ? null : (route.answerValue || route.answerLabel) }); }}><option value="exact">Exact answer</option><option value="range">Numeric range</option></select>{route.matchType === 'range' ? <div className="range-inputs"><input type="number" value={route.minValue ?? ''} onChange={(event) => updateRoute(index, { minValue: event.target.value === '' ? null : Number(event.target.value) })} placeholder="Min"/><input type="number" value={route.maxValue ?? ''} onChange={(event) => updateRoute(index, { maxValue: event.target.value === '' ? null : Number(event.target.value) })} placeholder="Max"/><input value={route.unit || ''} onChange={(event) => updateRoute(index, { unit: event.target.value })} placeholder="Unit"/></div> : null}</div><div className="pathway-cell"><select value={String(route.diseaseLabel || '').toLowerCase()} onChange={(event) => { const label = event.target.value; updateRoute(index, { diseaseLabel: title(label), diseaseKeys: label.split(' + ').map((item) => item.trim()) }); }}><option value="">Unassigned</option>{DISEASES.map((disease) => <option key={disease} value={disease}>{title(disease)}</option>)}</select><div className="pathway-chip"><i/> {route.diseaseLabel || 'Choose disease path'}</div></div><div className="kit-cell"><input value={(route.kitSlugs || []).join(', ')} onChange={(event) => updateRoute(index, { kitSlugs: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} placeholder="diabetes-kit-1"/>{route.kitSlugs?.[0] ? <small>{kitsBySlug.get(route.kitSlugs[0])?.name || 'Custom / future kit'}</small> : null}</div><div className="weight-cell"><input type="range" min="0" max="10" step="1" value={route.weight || 0} onChange={(event) => updateRoute(index, { weight: Number(event.target.value) })}/><strong>{route.weight || 0}</strong></div></div>)}</div>
            <button className="add-route-button" onClick={() => setDraft((current) => ({ ...current, routing: [...(current.routing || []), { answerValue: 'New signal', answerLabel: 'New signal', diseaseKeys: ['diabetes'], diseaseLabel: 'Diabetes', kitSlugs: ['diabetes-kit-1'], weight: 1 }] }))}>+ Add answer signal</button>
          </div>
          <footer className="routing-editor-footer"><span><i className="live-dot"/>Changes affect future quiz recommendations</span><button className="save-button" onClick={save} disabled={saving}>{saving ? 'Saving…' : <><MiniIcon name="check"/>Save routing rules<MiniIcon name="arrow" size={16}/></>}</button></footer>
        </>}
      </main>
    </section>
  </div>;
}
