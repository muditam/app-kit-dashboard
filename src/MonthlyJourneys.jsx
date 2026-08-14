import { useEffect, useMemo, useState } from 'react';
import { api } from './api';

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));

export default function MonthlyJourneys({ kits, onKitsChange, onToast }) {
  const combinations = useMemo(() => [...new Map(kits.map((kit) => [kit.conditionKey, kit.condition])).entries()], [kits]);
  const [selected, setSelected] = useState('');
  const [ordered, setOrdered] = useState([]);
  const [search, setSearch] = useState('');
  const [draggedId, setDraggedId] = useState('');
  const [expandedKits, setExpandedKits] = useState(() => new Set());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!selected && combinations.length) setSelected(combinations[0][0]); }, [combinations, selected]);
  useEffect(() => {
    setOrdered(kits.filter((kit) => kit.conditionKey === selected).sort((a, b) => (a.monthNumber || a.kitNumber) - (b.monthNumber || b.kitNumber)));
    setDirty(false);
  }, [kits, selected]);

  const shown = ordered.filter((kit) => `${kit.name} ${kit.slug}`.toLowerCase().includes(search.toLowerCase()));
  function moveBefore(targetId) {
    if (!draggedId || draggedId === targetId || search) return;
    setOrdered((current) => {
      const moving = current.find((kit) => kit._id === draggedId);
      const rest = current.filter((kit) => kit._id !== draggedId);
      const targetIndex = rest.findIndex((kit) => kit._id === targetId);
      rest.splice(targetIndex, 0, moving);
      return rest;
    });
    setDirty(true); setDraggedId('');
  }
  function nudge(id, change) {
    setOrdered((current) => {
      const index = current.findIndex((kit) => kit._id === id);
      const destination = index + change;
      if (destination < 0 || destination >= current.length) return current;
      const next = [...current]; [next[index], next[destination]] = [next[destination], next[index]]; return next;
    }); setDirty(true);
  }
  function toggleKit(id) {
    setExpandedKits((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  async function save() {
    setSaving(true);
    try {
      const response = await api.updateKitJourney(selected, ordered.map((kit) => kit._id));
      const changed = new Map(response.kits.map((kit) => [kit._id, kit]));
      onKitsChange(kits.map((kit) => changed.get(kit._id) || kit));
      setOrdered(response.kits); setDirty(false); onToast('Monthly journey saved');
    } catch (error) { onToast(error.message); }
    finally { setSaving(false); }
  }

  return <div className="journeys-page">
    <section className="journey-hero"><div><span>CARE PROGRAM ARCHITECTURE</span><h2>Monthly Journeys</h2><p>Arrange which kit a member receives in month 1, month 2 and beyond for every disease combination.</p></div><div className="journey-stat"><small>DISEASE PATHWAYS</small><strong>{combinations.length}</strong><span>{kits.length} kits sequenced</span></div></section>
    <section className="combination-strip"><div className="combination-intro"><small>SELECT A PATHWAY</small><strong>Disease combination</strong></div><div className="combination-tabs">{combinations.map(([key, label]) => <button key={key} className={selected === key ? 'selected' : ''} onClick={() => setSelected(key)}><i>{label.split(' + ').map((part) => part[0]).join('')}</i><span>{label}<small>{kits.filter((kit) => kit.conditionKey === key).length} months</small></span></button>)}</div></section>
    <section className="journey-layout">
      <aside className="panel journey-guide"><span className="step">01</span><h3>Build the sequence</h3><p>Drag a kit onto another row to place it before that month, or use the arrow buttons.</p><div className="journey-tip"><b>Month means delivery cycle</b><span>Each kit is a one-month supply. Its position here becomes its month number everywhere.</span></div><div className="journey-legend"><span><i className="active"/>Active kit</span><span><i/>Inactive kit</span><span><b>⋮⋮</b>Drag handle</span></div></aside>
      <section className="panel journey-board">
        <header><div><span className="step">02</span><div><small>MONTH-BY-MONTH PLAN</small><h3>{combinations.find(([key]) => key === selected)?.[1] || 'Disease journey'}</h3></div></div><label><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search kits in this journey..."/></label></header>
        {search && <div className="journey-search-note">Clear search to rearrange the complete journey safely.</div>}
        <div className="journey-timeline">
          {shown.map((kit) => { const month = ordered.findIndex((item) => item._id === kit._id) + 1; const expanded = expandedKits.has(kit._id); return <div key={kit._id} className={`journey-row ${draggedId === kit._id ? 'dragging' : ''}`} draggable={!search} onDragStart={() => setDraggedId(kit._id)} onDragOver={(event) => event.preventDefault()} onDrop={() => moveBefore(kit._id)}>
            <div className="month-marker"><span>MONTH</span><strong>{String(month).padStart(2, '0')}</strong></div><div className="timeline-line"><i/></div><div className={`journey-kit ${expanded ? 'expanded' : ''} `}><span className="journey-grip">⋮⋮</span><button className="journey-kit-copy" onClick={(event) => { event.stopPropagation(); toggleKit(kit._id); }} aria-expanded={expanded}><small>{kit.slug}</small><strong>{kit.name}</strong><span>{kit.products?.length || 0} products · {money(kit.price)} <b>{expanded ? '⌃ Hide products' : '⌄ View products'}</b></span></button><div className="journey-status"><i className={kit.active ? 'active' : ''}/>{kit.active ? 'Active' : 'Inactive'}</div><div className="journey-arrows"><button disabled={month === 1 || Boolean(search)} onClick={(event) => { event.stopPropagation(); nudge(kit._id, -1); }}>↑</button><button disabled={month === ordered.length || Boolean(search)} onClick={(event) => { event.stopPropagation(); nudge(kit._id, 1); }}>↓</button></div>{expanded && <div className="journey-kit-products">{kit.products?.length ? kit.products.map((item, index) => <div className="journey-product" key={item.product?._id || index}>{item.product?.image ? <img src={item.product.image} alt=""/> : <div className="journey-product-fallback">{item.product?.name?.slice(0, 1) || '?'}</div>}<div><strong>{item.product?.name || 'Unnamed product'}</strong><span>Quantity · {item.quantity || 1}</span></div></div>) : <span className="journey-no-products">No products have been added to this kit.</span>}</div>}</div>
          </div>; })}
          {!shown.length && <div className="journey-empty">No kits found in this disease combination.</div>}
        </div>
        <footer><span>{dirty ? 'Sequence changed — save to update month numbers.' : 'Journey is synchronized with the database.'}</span><button disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save monthly sequence'} <b>→</b></button></footer>
      </section>
    </section>
  </div>;
}
