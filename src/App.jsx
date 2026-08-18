import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import QuizRouting from './QuizRouting';
import RuleEngine from './RuleEngine';
import MonthlyJourneys from './MonthlyJourneys';
import UserAssessments from './UserAssessments';
import VideoLibrary from './VideoLibrary';
import Reels from './Reels';

const diseaseOptions = [
  { key: 'diabetes', label: 'Diabetes', icon: 'D' },
  { key: 'liver', label: 'Liver', icon: 'L' },
  { key: 'kidney', label: 'Kidney', icon: 'K' },
  { key: 'heart', label: 'Heart', icon: 'H' },
];
//blank
const blankEditor = () => ({
  _id: null, name: '', kitNumber: '', monthNumber: '', diseases: ['diabetes'], pricingMode: 'manual',
  price: '', active: true, products: [],
});

const money = (value) => value == null
  ? 'Price unavailable'
  : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

function Icon({ name, size = 18 }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    box: <><path d="m21 8-9 5-9-5 9-5 9 5Z"/><path d="m3 8 9 5 9-5v8l-9 5-9-5V8Z"/><path d="M12 13v8"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/><path d="M10 11v6M14 11v6"/></>,
    grip: <><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    refresh: <><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 1-2-5"/></>,
    shield: <><path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z"/><path d="m9 12 2 2 4-4"/></>,
    timeline: <><path d="M6 3v18M6 7h8l3 3-3 3H6M6 16h5l3 2-3 2H6"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    video: <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3V9Z"/></>,
    reel: <><rect x="6" y="2" width="12" height="20" rx="3"/><path d="m10 8 5 4-5 4V8Z"/><path d="M10 5h4"/></>,
  };
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function ProductImage({ product, small = false }) {
  const [failed, setFailed] = useState(false);
  if (!product?.image || failed) return <div className={`image-fallback ${small ? 'small' : ''}`}>{product?.name?.slice(0, 1) || '?'}</div>;
  return <img className={small ? 'product-image small' : 'product-image'} src={product.image} alt="" onError={() => setFailed(true)} />;
}

function ProductCard({ product, onAdd }) {
  return (
    <article className="product-card" draggable onDragStart={(event) => { event.dataTransfer.setData('text/product-id', String(product._id)); event.dataTransfer.effectAllowed = 'copy'; }}>
      <div className="drag-grip"><Icon name="grip" size={16}/></div>
      <ProductImage product={product}/>
      <div className="product-copy">
        <span className="category-label">{String(product.category || 'wellness').replaceAll('_', ' ')}</span>
        <strong>{product.name}</strong>
        <span className={product.unitPrice == null ? 'missing-price' : 'product-price'}>{money(product.unitPrice)}</span>
      </div>
      <button className="icon-button add-product" onClick={() => onAdd(product)} title={`Add ${product.name}`}><Icon name="plus" size={17}/></button>
    </article>
  );
}
//done
function KitCard({ kit, selected, onSelect, onStatus }) {
  const pictures = kit.products?.slice(0, 3) || [];
  return (
    <article className={`kit-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="kit-card-top">
        <span className={`status-pill ${kit.active ? 'active' : ''}`}><i />{kit.active ? 'Active' : 'Inactive'}</span>
        <button className={`mini-toggle ${kit.active ? 'on' : ''}`} onClick={(event) => { event.stopPropagation(); onStatus(!kit.active); }} aria-label="Toggle kit status"><span /></button>
      </div>
      <h3>{kit.name}</h3>
      <div className="kit-month-label">Month {kit.monthNumber || kit.kitNumber}</div>
      <div className="disease-row">{(kit.diseases || []).map((disease) => <span key={disease}>{disease}</span>)}</div>
      <div className="kit-card-bottom">
        <div className="avatar-stack">
          {pictures.map((item, index) => <div className="avatar" key={item.product?._id || index}><ProductImage product={item.product} small/></div>)}
          {(kit.products?.length || 0) > 3 && <div className="avatar more">+{kit.products.length - 3}</div>}
        </div>
        <div className="kit-price"><strong>{money(kit.price)}</strong><span>{kit.products?.length || 0} products</span></div>
      </div>
    </article>
  );
}

function EditorProduct({ item, onQuantity, onRemove }) {
  const product = item.product;
  return (
    <div className="editor-product">
      <ProductImage product={product} small/>
      <div className="editor-product-copy"><strong>{product.name}</strong><span>{money(product.unitPrice)} each</span></div>
      <div className="quantity-stepper">
        <button onClick={() => onQuantity(-1)}>−</button><span>{item.quantity}</span><button onClick={() => onQuantity(1)}>+</button>
      </div>
      <strong className="line-price">{product.unitPrice == null ? '—' : money(product.unitPrice * item.quantity)}</strong>
      <button className="remove-button" onClick={onRemove} title="Remove item"><Icon name="trash" size={16}/></button>
    </div>
  );
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [kits, setKits] = useState([]);
  const [editor, setEditor] = useState(blankEditor);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [kitFilter, setKitFilter] = useState('all');
  const [kitSearch, setKitSearch] = useState('');
  const [kitCombination, setKitCombination] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [activeView, setActiveView] = useState('kits');

  async function load() {
    setLoading(true); setError('');
    try {
      const [productData, kitData] = await Promise.all([api.getProducts(), api.getKits()]);
      setProducts(productData.products || []); setKits(kitData.kits || []);
      if (!editor._id && kitData.kits?.length) selectKit(kitData.kits[0]);
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { if (!toast) return undefined; const timer = setTimeout(() => setToast(''), 2600); return () => clearTimeout(timer); }, [toast]);

  const categories = useMemo(() => ['all', ...new Set(products.map((product) => product.category).filter(Boolean))], [products]);
  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesSearch = `${product.name} ${product.sku || ''}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (category === 'all' || product.category === category);
  }), [products, search, category]);
  const kitCombinations = useMemo(() => [...new Map(kits.map((kit) => [kit.conditionKey, kit.condition])).entries()], [kits]);
  const filteredKits = useMemo(() => kits.filter((kit) => {
    const statusMatch = kitFilter === 'all' || (kit.active ? 'active' : 'inactive') === kitFilter;
    const combinationMatch = kitCombination === 'all' || kit.conditionKey === kitCombination;
    const searchMatch = `${kit.name} ${kit.slug} ${kit.condition}`.toLowerCase().includes(kitSearch.toLowerCase());
    return statusMatch && combinationMatch && searchMatch;
  }).sort((a, b) => a.conditionKey.localeCompare(b.conditionKey) || (a.monthNumber || a.kitNumber) - (b.monthNumber || b.kitNumber)), [kits, kitFilter, kitCombination, kitSearch]);
  const calculatedTotal = useMemo(() => editor.products.reduce((total, item) => total + (Number(item.product?.unitPrice) || 0) * item.quantity, 0), [editor.products]);
  const missingPrice = editor.products.some((item) => item.product?.unitPrice == null);

  function selectKit(kit) {
    setEditor({
      _id: kit._id, name: kit.name, kitNumber: kit.kitNumber, monthNumber: kit.monthNumber || kit.kitNumber, diseases: kit.diseaseKeys || ['diabetes'],
      pricingMode: kit.pricingMode || 'manual', price: kit.price, active: kit.active,
      products: (kit.products || []).map((item) => ({ product: item.product, quantity: item.quantity })),
    });
  }

  function addProduct(product) {
    setEditor((current) => {
      const exists = current.products.find((item) => String(item.product._id) === String(product._id));
      return { ...current, products: exists
        ? current.products.map((item) => String(item.product._id) === String(product._id) ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current.products, { product, quantity: 1 }] };
    });
  }

  function addDropped(event) {
    event.preventDefault(); setDragOver(false);
    const id = event.dataTransfer.getData('text/product-id');
    const product = products.find((item) => String(item._id) === id);
    if (product) addProduct(product);
  }

  function updateQuantity(id, change) {
    setEditor((current) => ({ ...current, products: current.products
      .map((item) => String(item.product._id) === String(id) ? { ...item, quantity: Math.max(1, item.quantity + change) } : item) }));
  }

  function toggleDisease(key) {
    setEditor((current) => {
      const selected = current.diseases.includes(key);
      if (selected && current.diseases.length === 1) return current;
      return { ...current, diseases: selected ? current.diseases.filter((item) => item !== key) : [...current.diseases, key] };
    });
  }

  async function saveKit() {
    if (!editor.products.length) return setToast('Add at least one product to the kit');
    if (editor.pricingMode === 'calculated' && missingPrice) return setToast('Some products do not have a catalog price');
    setSaving(true);
    try {
      const payload = {
        name: editor.name, monthNumber: editor.monthNumber ? Number(editor.monthNumber) : undefined,
        diseases: editor.diseases, pricingMode: editor.pricingMode,
        price: editor.pricingMode === 'calculated' ? calculatedTotal : Number(editor.price), active: editor.active,
        products: editor.products.map((item) => ({ product: item.product._id, quantity: item.quantity })),
      };
      const response = editor._id ? await api.updateKit(editor._id, payload) : await api.createKit(payload);
      setKits((current) => editor._id ? current.map((kit) => kit._id === response.kit._id ? response.kit : kit) : [...current, response.kit]);
      selectKit(response.kit); setToast(editor._id ? 'Kit changes saved' : 'New kit created');
    } catch (saveError) { setToast(saveError.message); }
    finally { setSaving(false); }
  }

  async function setStatus(kit, active) {
    try {
      const { kit: updated } = await api.setKitStatus(kit._id, active);
      setKits((current) => current.map((item) => item._id === updated._id ? updated : item));
      if (editor._id === updated._id) selectKit(updated);
      setToast(active ? 'Kit activated' : 'Kit deactivated');
    } catch (statusError) { setToast(statusError.message); }
  }

  const metrics = {
    active: kits.filter((kit) => kit.active).length,
    combinations: new Set(kits.map((kit) => kit.conditionKey)).size,
    average: kits.length ? kits.reduce((sum, kit) => sum + Number(kit.price || 0), 0) / kits.length : 0,
  };

  return (
    <div className="app-shell">
      <aside className="rail">
        <div className="brand-mark">m<span>u</span></div>
        <nav><button className={activeView === 'kits' ? 'active' : ''} onClick={() => setActiveView('kits')} aria-label="Kit Studio"><Icon name="grid"/></button><button className={activeView === 'journeys' ? 'active' : ''} onClick={() => setActiveView('journeys')} aria-label="Monthly journeys"><Icon name="timeline"/></button><button className={activeView === 'routing' ? 'active' : ''} onClick={() => setActiveView('routing')} aria-label="Quiz and routing"><Icon name="spark"/></button><button className={activeView === 'rules' ? 'active' : ''} onClick={() => setActiveView('rules')} aria-label="Rules Studio"><Icon name="shield"/></button><button className={activeView === 'users' ? 'active' : ''} onClick={() => setActiveView('users')} aria-label="User assessments"><Icon name="users"/></button><button className={activeView === 'videos' ? 'active' : ''} onClick={() => setActiveView('videos')} aria-label="Class video library"><Icon name="video"/></button><button className={activeView === 'reels' ? 'active' : ''} onClick={() => setActiveView('reels')} aria-label="Reels studio"><Icon name="reel"/></button></nav>
        <div className="profile-dot">AN</div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><span className="eyebrow">{activeView === 'kits' ? 'METABOLIC CARE / KIT MANAGEMENT' : activeView === 'journeys' ? 'CARE PROGRAMS / MONTHLY SEQUENCING' : activeView === 'routing' ? 'ASSESSMENT INTELLIGENCE / KIT ROUTING' : activeView === 'rules' ? 'DECISION ENGINE / RECOMMENDATION RULES' : activeView === 'videos' ? 'CONTENT OPERATIONS / CLASS VIDEO LIBRARY' : activeView === 'reels' ? 'CONTENT OPERATIONS / REEL STUDIO' : 'MEMBER INTELLIGENCE / QUIZ OUTCOMES'}</span><h1>{activeView === 'kits' ? 'Kit Studio' : activeView === 'journeys' ? 'Treatment journeys' : activeView === 'routing' ? 'Quiz & routing' : activeView === 'rules' ? 'Rules & guardrails' : activeView === 'videos' ? 'Class videos' : activeView === 'reels' ? 'Reels & analytics' : 'User assessments'}</h1><p>{activeView === 'kits' ? 'Compose precise care kits from your live product catalogue.' : activeView === 'journeys' ? 'Arrange each disease pathway into a clear month-by-month care program.' : activeView === 'routing' ? 'Tune how each answer guides a member toward the right disease pathway and kit.' : activeView === 'rules' ? 'Define the safeguards, overrides and constraints applied to every recommendation.' : activeView === 'videos' ? 'Upload private class videos to Wasabi and manage publication.' : activeView === 'reels' ? 'Publish short-form health content and measure every reel independently.' : 'Search members and understand exactly how their quiz became a kit recommendation.'}</p></div>
          <div className="header-actions">{activeView === 'kits' && <><button className="secondary-button" onClick={load}><Icon name="refresh"/>Refresh</button><button className="primary-button" onClick={() => setEditor(blankEditor())}><Icon name="plus"/>Create new kit</button></>}</div>
        </header>

        {activeView === 'reels' ? <Reels onToast={setToast}/> : activeView === 'videos' ? <VideoLibrary onToast={setToast}/> : activeView === 'users' ? <UserAssessments/> : activeView === 'rules' ? <RuleEngine onToast={setToast}/> : activeView === 'journeys' ? <MonthlyJourneys kits={kits} onKitsChange={setKits} onToast={setToast}/> : activeView === 'routing' ? <QuizRouting onToast={setToast}/> : <>
        <section className="metrics-row">
          <div className="metric-card accent"><span>Active kits</span><strong>{metrics.active}</strong><small>of {kits.length} total</small></div>
          <div className="metric-card"><span>Disease combinations</span><strong>{metrics.combinations}</strong><small>personalized pathways</small></div>
          <div className="metric-card"><span>Average kit price</span><strong>{money(metrics.average)}</strong><small>across all kits</small></div>
          <div className="metric-card product-count"><span>Catalog products</span><strong>{products.length}</strong><small>ready to compose</small></div>
        </section>

        {error && <div className="error-banner"><strong>Dashboard could not connect.</strong><span>{error}</span><button onClick={load}>Try again</button></div>}

        <section className="studio-grid">
          <aside className="panel product-library">
            <div className="panel-heading"><div><span className="step">01</span><h2>Product library</h2></div><span className="count-badge">{filteredProducts.length}</span></div>
            <label className="search-box"><Icon name="search"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products..."/></label>
            <div className="filter-chips">
              {categories.map((item) => <button key={item} className={category === item ? 'selected' : ''} onClick={() => setCategory(item)}>{item === 'all' ? 'All' : String(item).replaceAll('_', ' ')}</button>)}
            </div>
            <p className="drag-hint"><Icon name="grip" size={14}/>Drag a product into the kit editor</p>
            <div className="product-list">
              {loading ? [...Array(5)].map((_, index) => <div className="skeleton product-skeleton" key={index}/>) : filteredProducts.map((product) => <ProductCard key={product._id} product={product} onAdd={addProduct}/>)}
            </div>
          </aside>

          <section className="panel kit-library">
            <div className="panel-heading"><div><span className="step">02</span><h2>Existing kits</h2></div></div>
            <label className="search-box kit-search-box"><Icon name="search"/><input value={kitSearch} onChange={(event) => setKitSearch(event.target.value)} placeholder="Search kit name or disease..."/></label>
            <select className="kit-combination-select" value={kitCombination} onChange={(event) => setKitCombination(event.target.value)}><option value="all">All disease combinations</option>{kitCombinations.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            <div className="segmented small">
              {['all', 'active', 'inactive'].map((item) => <button key={item} className={kitFilter === item ? 'selected' : ''} onClick={() => setKitFilter(item)}>{item}</button>)}
            </div>
            <div className="kit-list">
              {loading ? [...Array(4)].map((_, index) => <div className="skeleton kit-skeleton" key={index}/>) : [...new Map(filteredKits.map((kit) => [kit.conditionKey, kit.condition])).entries()].map(([conditionKey, condition]) => <div className="kit-condition-group" key={conditionKey}><div className="kit-group-heading"><strong>{condition}</strong><span>{filteredKits.filter((kit) => kit.conditionKey === conditionKey).length} months</span></div>{filteredKits.filter((kit) => kit.conditionKey === conditionKey).map((kit) => <KitCard key={kit._id} kit={kit} selected={editor._id === kit._id} onSelect={() => selectKit(kit)} onStatus={(active) => setStatus(kit, active)}/>)}</div>)}
              {!loading && !filteredKits.length && <div className="empty-state"><Icon name="box" size={28}/><strong>No kits here yet</strong><span>Create one from the product library.</span></div>}
            </div>
          </section>

          <section className="panel editor-panel">
            <div className="editor-header">
              <div><span className="step">03</span><div><span className="editor-mode">{editor._id ? 'EDITING KIT' : 'NEW KIT'}</span><input className="title-input" value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} placeholder="Untitled metabolic kit"/></div></div>
              <label className="status-control"><span>{editor.active ? 'Active' : 'Inactive'}</span><input type="checkbox" checked={editor.active} onChange={(event) => setEditor({ ...editor, active: event.target.checked })}/><i/></label>
            </div>

            <div className="editor-section disease-section">
              <div className="section-title"><span>Disease combination</span><small>Select every condition this kit supports</small></div>
              <div className="disease-picker">{diseaseOptions.map((option) => <button key={option.key} className={editor.diseases.includes(option.key) ? 'selected' : ''} onClick={() => toggleDisease(option.key)}><i>{option.icon}</i>{option.label}{editor.diseases.includes(option.key) && <Icon name="check" size={15}/>}</button>)}</div>
              <label className="month-number-field"><span><b>Delivery month</b><small>Which month of this disease journey?</small></span><div>MONTH <input type="number" min="1" value={editor.monthNumber} onChange={(event) => setEditor({ ...editor, monthNumber: event.target.value })} placeholder="Auto"/></div></label>
            </div>

            <div className="editor-section">
              <div className="section-title"><span>Products in this kit</span><small>{editor.products.reduce((sum, item) => sum + item.quantity, 0)} total units</small></div>
              <div className={`drop-zone ${dragOver ? 'dragging' : ''} ${!editor.products.length ? 'empty' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={addDropped}>
                {!editor.products.length && <div className="drop-placeholder"><div><Icon name="plus" size={22}/></div><strong>Drop products here</strong><span>or use the + button in the library</span></div>}
                {editor.products.map((item) => <EditorProduct key={item.product._id} item={item} onQuantity={(change) => updateQuantity(item.product._id, change)} onRemove={() => setEditor((current) => ({ ...current, products: current.products.filter((entry) => entry.product._id !== item.product._id) }))}/>)}
              </div>
            </div>

            <div className="editor-section pricing-section">
              <div className="section-title"><span>Kit pricing</span><small>Choose how the final price is set</small></div>
              <div className="segmented pricing-toggle"><button className={editor.pricingMode === 'manual' ? 'selected' : ''} onClick={() => setEditor({ ...editor, pricingMode: 'manual' })}>Set kit price</button><button className={editor.pricingMode === 'calculated' ? 'selected' : ''} onClick={() => setEditor({ ...editor, pricingMode: 'calculated' })}><Icon name="spark" size={15}/>Calculate from items</button></div>
              <div className="price-card">
                <div><span>{editor.pricingMode === 'manual' ? 'FINAL KIT PRICE' : 'CALCULATED TOTAL'}</span>{editor.pricingMode === 'manual' ? <label className="price-input"><b>₹</b><input type="number" min="0" value={editor.price} onChange={(event) => setEditor({ ...editor, price: event.target.value })} placeholder="0"/></label> : <strong>{money(calculatedTotal)}</strong>}</div>
                <div className="calculation"><span>Items subtotal</span><strong>{missingPrice ? 'Some prices unavailable' : money(calculatedTotal)}</strong><small>{editor.products.reduce((sum, item) => sum + item.quantity, 0)} units · 1 month supply</small></div>
              </div>
            </div>

            <footer className="editor-footer"><div><span>{editor._id ? 'Last changes are saved to the live database' : 'A new kit will be added to this combination'}</span></div><button className="save-button" onClick={saveKit} disabled={saving}>{saving ? <span className="spinner"/> : <Icon name="check"/>}{saving ? 'Saving...' : editor._id ? 'Save changes' : 'Create kit'}<Icon name="chevron" size={16}/></button></footer>
          </section>
        </section>
        </>}
      </main>
      {toast && <div className="toast"><Icon name="check"/><span>{toast}</span></div>}
    </div>
  );
}
