import { useEffect, useMemo, useState } from 'react';
import { api } from './api';

const types = {
  safety: { label: 'Safety', note: 'Stops unsafe automatic recommendations', order: '01' },
  fixed: { label: 'Fixed', note: 'Forces a known kit for an exact situation', order: '02' },
  mandatory: { label: 'Mandatory', note: 'Requires or excludes kits and products', order: '03' },
  contextual: { label: 'Contextual', note: 'Adds a scoring boost after quiz routing', order: '04' },
};

const fields = ['diagnosis', 'hba1cValue', 'fbsValue', 'age', 'bmi', 'gender', 'duration', 'gestational', 'familyHistory', 'symptoms', 'conditions', 'management', 'sleep', 'stress', 'sugarFreq', 'activity', 'weightChange', 'goal'];
const operators = ['equals', 'not_equals', 'in', 'not_in', 'greater_than', 'greater_or_equal', 'less_than', 'less_or_equal', 'between', 'includes'];
const actions = {
  safety: ['block_recommendation', 'doctor_referral'],
  fixed: ['force_kit'],
  mandatory: ['require_kit', 'require_products', 'exclude_products'],
  contextual: ['boost_kits'],
};

const blankRule = () => ({
  _id: null, ruleId: '', name: '', description: '', type: 'contextual', priority: 300,
  active: true, conditionLogic: 'all', conditions: [{ field: 'diagnosis', operator: 'equals', value: '' }],
  action: { type: 'boost_kits', message: '', kitSlugs: [], productSlugs: [], weight: 1 },
});

const words = (value) => String(value || '').replaceAll('_', ' ');
const csv = (value) => Array.isArray(value) ? value.join(', ') : '';
const splitCsv = (value) => value.split(',').map((item) => item.trim()).filter(Boolean);

function RuleCard({ rule, selected, onClick }) {
  return <button className={`rule-list-card ${selected ? 'selected' : ''}`} onClick={onClick}>
    <span className={`rule-type ${rule.type}`}>{types[rule.type]?.label}</span>
    <span className="rule-list-copy"><small>{rule.ruleId}</small><strong>{rule.name}</strong><em>{rule.conditions?.length || 0} condition{rule.conditions?.length === 1 ? '' : 's'}</em></span>
    <span className="rule-priority"><small>PRIORITY</small><strong>{rule.priority}</strong><i className={rule.active ? 'live' : ''}/></span>
  </button>;
}

function ConditionRow({ condition, index, onChange, onRemove }) {
  const numeric = ['hba1cValue', 'fbsValue', 'age', 'bmi'].includes(condition.field);
  return <div className="condition-row">
    <span className="condition-number">{String(index + 1).padStart(2, '0')}</span>
    <label><small>ANSWER FIELD</small><select value={condition.field} onChange={(e) => onChange({ ...condition, field: e.target.value })}>{fields.map((field) => <option key={field} value={field}>{words(field)}</option>)}</select></label>
    <label><small>COMPARISON</small><select value={condition.operator} onChange={(e) => onChange({ ...condition, operator: e.target.value })}>{operators.map((operator) => <option key={operator} value={operator}>{words(operator)}</option>)}</select></label>
    {condition.operator === 'between' ? <div className="condition-between"><label><small>MIN</small><input type="number" value={condition.minValue ?? ''} onChange={(e) => onChange({ ...condition, minValue: e.target.value })}/></label><label><small>MAX</small><input type="number" value={condition.maxValue ?? ''} onChange={(e) => onChange({ ...condition, maxValue: e.target.value })}/></label></div>
      : ['in', 'not_in'].includes(condition.operator) ? <label><small>VALUES · COMMA SEPARATED</small><input value={csv(condition.values)} onChange={(e) => onChange({ ...condition, values: splitCsv(e.target.value) })} placeholder="Option A, Option B"/></label>
      : <label><small>VALUE</small><input type={numeric ? 'number' : 'text'} value={condition.value ?? ''} onChange={(e) => onChange({ ...condition, value: e.target.value })} placeholder="Answer to match"/></label>}
    <button className="condition-remove" onClick={onRemove} aria-label="Remove condition">×</button>
  </div>;
}

export default function RuleEngine({ onToast }) {
  const [rules, setRules] = useState([]);
  const [draft, setDraft] = useState(blankRule);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await api.getRules();
      setRules(response.rules || []);
      if (!draft._id && response.rules?.length) setDraft(response.rules[0]);
    } catch (error) { onToast(error.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const visible = useMemo(() => rules.filter((rule) => (filter === 'all' || rule.type === filter) && `${rule.ruleId} ${rule.name}`.toLowerCase().includes(search.toLowerCase())), [rules, filter, search]);
  const counts = Object.fromEntries(Object.keys(types).map((type) => [type, rules.filter((rule) => rule.type === type && rule.active).length]));

  function setType(type) {
    setDraft((current) => ({ ...current, type, action: { ...current.action, type: actions[type][0] } }));
  }
  function updateCondition(index, condition) {
    setDraft((current) => ({ ...current, conditions: current.conditions.map((item, position) => position === index ? condition : item) }));
  }
  async function save() {
    if (!draft.ruleId.trim() || !draft.name.trim()) return onToast('Rule ID and name are required');
    if (!draft.conditions.length) return onToast('Add at least one condition');
    setSaving(true);
    try {
      const payload = { ...draft, ruleId: draft.ruleId.trim().toUpperCase(), priority: Number(draft.priority), action: { ...draft.action, weight: Number(draft.action.weight || 0) } };
      const response = draft._id ? await api.updateRule(draft._id, payload) : await api.createRule(payload);
      setRules((current) => draft._id ? current.map((rule) => rule._id === response.rule._id ? response.rule : rule) : [...current, response.rule]);
      setDraft(response.rule); onToast(draft._id ? 'Rule updated' : 'Rule created');
    } catch (error) { onToast(error.message); }
    finally { setSaving(false); }
  }

  return <div className="rules-page">
    <section className="rules-hero">
      <div><span className="eyebrow">RECOMMENDATION INTELLIGENCE / GUARDRAILS</span><h2>Rules Studio</h2><p>Control safety, fixed outcomes, mandatory contents and contextual scoring around the quiz recommendation engine.</p></div>
      <div className="rules-health"><i/><span>ENGINE STATUS</span><strong>{rules.filter((rule) => rule.active).length} active rules</strong><small>Evaluated by priority</small></div>
    </section>

    <section className="rule-metrics">{Object.entries(types).map(([type, info]) => <button key={type} className={`rule-metric ${type}`} onClick={() => setFilter(type)}><span>{info.order}</span><div><small>{info.label} rules</small><strong>{counts[type] || 0}</strong><em>{info.note}</em></div></button>)}</section>

    <section className="rules-workspace">
      <aside className="panel rules-library">
        <div className="rule-panel-head"><div><span className="step">01</span><div><h3>Rule library</h3><small>{rules.length} rules · sorted by priority</small></div></div><button onClick={() => setDraft(blankRule())}>＋</button></div>
        <input className="rule-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rule name or ID..."/>
        <div className="rule-filter">{['all', ...Object.keys(types)].map((type) => <button key={type} className={filter === type ? 'selected' : ''} onClick={() => setFilter(type)}>{type}</button>)}</div>
        <div className="rule-list">{loading ? <div className="rule-loading">Loading rules…</div> : visible.map((rule) => <RuleCard key={rule._id} rule={rule} selected={draft._id === rule._id} onClick={() => setDraft(rule)}/>)}{!loading && !visible.length && <div className="rule-loading">No matching rules</div>}</div>
      </aside>

      <section className="panel rule-editor">
        <header className="rule-editor-head"><div><span className="step">02</span><div><small>{draft._id ? 'FINE-TUNING RULE' : 'CREATING NEW RULE'}</small><h3>{draft.name || 'Untitled recommendation rule'}</h3></div></div><label className="rule-switch"><span>{draft.active ? 'Active' : 'Inactive'}</span><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })}/><i/></label></header>
        <div className="rule-editor-body">
          <div className="rule-basics">
            <label><small>RULE ID</small><input value={draft.ruleId} onChange={(e) => setDraft({ ...draft, ruleId: e.target.value })} placeholder="CT-003"/></label>
            <label><small>RULE NAME</small><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Low activity support"/></label>
            <label className="wide"><small>PLAIN-ENGLISH PURPOSE</small><textarea value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Explain when and why this rule should run."/></label>
          </div>

          <div className="rule-type-picker">{Object.entries(types).map(([type, info]) => <button key={type} className={`${type} ${draft.type === type ? 'selected' : ''}`} onClick={() => setType(type)}><span>{info.order}</span><strong>{info.label}</strong><small>{info.note}</small></button>)}</div>

          <div className="priority-card"><div><small>EXECUTION PRIORITY</small><strong>{draft.priority}</strong><p>Higher numbers run first within the rule engine.</p></div><input type="range" min="0" max="1000" step="10" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}/><input type="number" min="0" max="1000" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}/></div>

          <div className="condition-heading"><div><small>WHEN SHOULD THIS RUN?</small><h3>Answer conditions</h3></div><div className="logic-toggle"><span>Match</span><button className={draft.conditionLogic === 'all' ? 'selected' : ''} onClick={() => setDraft({ ...draft, conditionLogic: 'all' })}>ALL</button><button className={draft.conditionLogic === 'any' ? 'selected' : ''} onClick={() => setDraft({ ...draft, conditionLogic: 'any' })}>ANY</button></div></div>
          <div className="condition-list">{draft.conditions.map((condition, index) => <ConditionRow key={index} condition={condition} index={index} onChange={(value) => updateCondition(index, value)} onRemove={() => setDraft((current) => ({ ...current, conditions: current.conditions.filter((_, position) => position !== index) }))}/>)}</div>
          <button className="add-condition" onClick={() => setDraft((current) => ({ ...current, conditions: [...current.conditions, { field: 'diagnosis', operator: 'equals', value: '' }] }))}>＋ Add another condition</button>

          <div className={`action-card ${draft.type}`}><div className="action-title"><span>THEN</span><div><small>RULE OUTCOME</small><strong>{types[draft.type].label} action</strong></div></div><div className="action-fields">
            <label><small>ACTION</small><select value={draft.action.type} onChange={(e) => setDraft({ ...draft, action: { ...draft.action, type: e.target.value } })}>{actions[draft.type].map((action) => <option key={action} value={action}>{words(action)}</option>)}</select></label>
            {['force_kit', 'require_kit', 'boost_kits'].includes(draft.action.type) && <label><small>KIT SLUGS · COMMA SEPARATED</small><input value={csv(draft.action.kitSlugs)} onChange={(e) => setDraft({ ...draft, action: { ...draft.action, kitSlugs: splitCsv(e.target.value) } })} placeholder="diabetes-kit-3"/></label>}
            {['require_products', 'exclude_products'].includes(draft.action.type) && <label><small>PRODUCT SLUGS · COMMA SEPARATED</small><input value={csv(draft.action.productSlugs)} onChange={(e) => setDraft({ ...draft, action: { ...draft.action, productSlugs: splitCsv(e.target.value) } })} placeholder="karela-jamun-fizz"/></label>}
            {draft.action.type === 'boost_kits' && <label><small>SCORE BOOST</small><input type="number" min="0" step="0.5" value={draft.action.weight ?? 1} onChange={(e) => setDraft({ ...draft, action: { ...draft.action, weight: e.target.value } })}/></label>}
            <label className="wide"><small>EXPLANATION SHOWN WITH RESULT</small><input value={draft.action.message || ''} onChange={(e) => setDraft({ ...draft, action: { ...draft.action, message: e.target.value } })} placeholder="Why this action was applied"/></label>
          </div></div>
        </div>
        <footer className="rule-editor-footer"><span><i/>Changes affect future recommendations after saving.</span><button onClick={save} disabled={saving}>{saving ? 'Saving…' : draft._id ? 'Save rule changes' : 'Create rule'} <b>→</b></button></footer>
      </section>
    </section>

    <section className="panel rule-flow"><div className="flow-heading"><div><span className="step">03</span><div><h3>How a recommendation is decided</h3><small>The engine preserves quiz scoring and layers operational rules around it.</small></div></div><span className="flow-note">Higher priority rules are evaluated first</span></div><div className="flow-track">
      <div className="flow-node input"><span>INPUT</span><strong>Quiz answers</strong><small>Member context</small></div><b>→</b>
      <div className="flow-node safety"><span>GATE 01</span><strong>Safety</strong><small>Block or refer</small></div><b>→</b>
      <div className="flow-node fixed"><span>OVERRIDE 02</span><strong>Fixed</strong><small>Force exact kit</small></div><b>→</b>
      <div className="flow-node routing"><span>CORE</span><strong>Quiz weights</strong><small>Score pathways</small></div><b>→</b>
      <div className="flow-node mandatory"><span>FILTER 03</span><strong>Mandatory</strong><small>Require / exclude</small></div><b>→</b>
      <div className="flow-node contextual"><span>BOOST 04</span><strong>Contextual</strong><small>Fine-tune score</small></div><b>→</b>
      <div className="flow-node result"><span>OUTPUT</span><strong>Best active kit</strong><small>With reasons</small></div>
    </div></section>
  </div>;
}
