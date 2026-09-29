import { useEffect, useMemo, useState } from 'react';
import { api } from './api';

const usd = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(Number(value || 0));
const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

export default function AICostAnalytics({ onToast }) {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getAIUsage(period).then(setData).catch((error) => onToast(error.message)).finally(() => setLoading(false));
  }, [period]);

  const maxTimeline = Math.max(0.000001, ...(data?.timeline || []).map((item) => item.costUsd || 0));
  const topModule = data?.modules?.find((item) => item.costUsd > 0);
  const successRate = data?.total?.requests ? Math.max(0, 100 - ((data.total.failed / data.total.requests) * 100)) : 100;
  const hasUsage = Number(data?.total?.requests || 0) > 0;

  return <div className="ai-cost-page">
    <section className="ai-cost-hero">
      <div><span>AI OPERATIONS / COST INTELLIGENCE</span><h2>Know what every AI feature costs.</h2><p>Token and request-level metering for this backend, separated by product module and model.</p></div>
      <div className="ai-period-control">{['day', 'week', 'month'].map((item) => <button key={item} className={period === item ? 'selected' : ''} onClick={() => setPeriod(item)}>{item === 'day' ? 'Today' : `This ${item}`}</button>)}</div>
    </section>

    <section className="ai-cost-metrics">
      <div className="primary"><span>Estimated spend</span><strong>{usd(data?.total?.costUsd)}</strong><small>{period} · this app only</small></div>
      <div><span>Provider requests</span><strong>{compact.format(data?.total?.requests || 0)}</strong><small>{successRate.toFixed(1)}% successful</small></div>
      <div><span>Total tokens</span><strong>{compact.format(data?.total?.totalTokens || 0)}</strong><small>{compact.format(data?.total?.cachedInputTokens || 0)} cached input</small></div>
      <div><span>Highest-spend module</span><strong>{topModule?.label || 'No spend yet'}</strong><small>{topModule ? usd(topModule.costUsd) : 'Waiting for metered calls'}</small></div>
    </section>

    <section className="ai-cost-grid">
      <div className="panel ai-module-panel">
        <div className="ai-panel-head"><div><small>MODULE ATTRIBUTION</small><h3>Where the budget goes</h3></div><span>{data?.modules?.length || 0} modules</span></div>
        {loading ? <div className="ai-loading">Loading cost ledger…</div> : <div className="ai-module-list">{(data?.modules || []).map((item) => {
          const percent = data.total.costUsd ? (item.costUsd / data.total.costUsd) * 100 : 0;
          return <article key={item.key} className={item.key === 'quiz_recommendation' ? 'deterministic' : ''}>
            <div className="ai-module-icon">{item.key === 'ai_chat' ? 'C' : item.key === 'diet_plan' ? 'D' : item.key === 'glucometer_vision' ? 'V' : 'Q'}</div>
            <div><strong>{item.label}</strong><span>{item.key === 'quiz_recommendation' ? 'Deterministic rules · no model call' : `${compact.format(item.requests)} calls · ${compact.format(item.totalTokens)} tokens`}</span><i><b style={{ width: `${Math.max(item.costUsd ? 4 : 0, percent)}%` }}/></i></div>
            <em>{usd(item.costUsd)}</em>
          </article>;
        })}</div>}
      </div>

      <div className="panel ai-trend-panel">
        <div className="ai-panel-head"><div><small>SPEND TREND</small><h3>{period === 'day' ? 'Hourly' : 'Daily'} AI cost</h3></div><span>USD estimate</span></div>
        {!hasUsage ? <div className="ai-empty-chart"><strong>No metered calls yet</strong><span>Usage will appear after this deployment handles AI requests.</span></div> : <div className="ai-cost-bars">{(data?.timeline || []).map((item) => <div key={item.bucket} title={`${item.bucket}: ${usd(item.costUsd)}`}><span>{usd(item.costUsd)}</span><i style={{ height: `${Math.max(5, (item.costUsd / maxTimeline) * 100)}%` }}/><small>{item.bucket}</small></div>)}</div>}
      </div>
    </section>

    <section className="panel ai-model-panel">
      <div className="ai-panel-head"><div><small>MODEL BREAKDOWN</small><h3>Models used by this application</h3></div><span>Input, cached and output tokens</span></div>
      <div className="ai-model-table"><div className="head"><span>Provider / model</span><span>Requests</span><span>Input</span><span>Cached</span><span>Output</span><span>Cost</span></div>{(data?.models || []).map((item) => <div key={item.key}><strong><small>{item.provider}</small>{item.model}</strong><span>{compact.format(item.requests)}</span><span>{compact.format(item.inputTokens)}</span><span>{compact.format(item.cachedInputTokens)}</span><span>{compact.format(item.outputTokens)}</span><b>{usd(item.costUsd)}</b></div>)}{!data?.models?.length && <p>No model usage has been recorded in this period.</p>}</div>
      <div className="ai-cost-note"><strong>How to read this</strong><span>Module costs are application estimates calculated from provider-returned usage. For invoice reconciliation, use an OpenAI Admin key/project Costs report. A shared key used by other apps cannot retroactively identify which app created older spend.</span></div>
    </section>
  </div>;
}
