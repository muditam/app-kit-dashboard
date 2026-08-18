import { useEffect, useMemo, useState } from 'react';
import { reelApi } from './reelApi';

const initialForm = { title: '', description: '', tags: '', publish: true };
const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
const statusLabel = (value) => String(value || 'draft').replaceAll('_', ' ');
const duration = (seconds) => {
  const value = Math.max(0, Math.round(Number(seconds || 0)));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
};
const watchTime = (seconds) => Number(seconds || 0) >= 3600
  ? `${(Number(seconds) / 3600).toFixed(1)}h`
  : `${Math.round(Number(seconds || 0) / 60)}m`;

function readMetadata(file) {
  return new Promise((resolve, reject) => {
    const element = document.createElement('video');
    const url = URL.createObjectURL(file);
    element.preload = 'metadata';
    element.onloadedmetadata = () => {
      const value = { durationSeconds: Number(element.duration), width: element.videoWidth, height: element.videoHeight };
      URL.revokeObjectURL(url);
      if (!Number.isFinite(value.durationSeconds) || value.durationSeconds <= 0) reject(new Error('Could not read this MP4 reel.'));
      else resolve(value);
    };
    element.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Select a browser-compatible MP4 reel.')); };
    element.src = url;
  });
}

function Metric({ label, value, note, accent = false }) {
  return <article className={`reel-metric ${accent ? 'accent' : ''}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

export default function Reels({ onToast }) {
  const [reels, setReels] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [days, setDays] = useState(30);
  const [form, setForm] = useState(initialForm);
  const [file, setFile] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const selected = reels.find((item) => item.id === selectedId) || null;
  const totals = useMemo(() => reels.reduce((value, reel) => ({
    views: value.views + Number(reel.analytics?.views || 0),
    watchSeconds: value.watchSeconds + Number(reel.analytics?.totalWatchSeconds || 0),
    likes: value.likes + Number(reel.analytics?.likes || 0),
  }), { views: 0, watchSeconds: 0, likes: 0 }), [reels]);

  async function load(preferredId) {
    setLoading(true); setError('');
    try {
      const data = await reelApi.list();
      const items = data.reels || [];
      setReels(items);
      setSelectedId((current) => preferredId || (items.some((item) => item.id === current) ? current : items[0]?.id || null));
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!selectedId) { setAnalytics(null); return; }
    reelApi.analytics(selectedId, days).then((data) => setAnalytics(data.analytics)).catch((value) => setError(value.message));
  }, [selectedId, days]);

  async function selectFile(event) {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile); setMetadata(null); setError('');
    if (!selectedFile) return;
    if (selectedFile.type && selectedFile.type !== 'video/mp4') return setError('Only MP4 reels are currently supported.');
    try { setMetadata(await readMetadata(selectedFile)); }
    catch (metadataError) { setError(metadataError.message); }
  }

  async function submit(event) {
    event.preventDefault();
    if (!file || !metadata) return setError('Select a valid MP4 reel first.');
    // React clears currentTarget after the synchronous event handler returns.
    // Keep the form reference before awaiting the upload requests so the
    // native file input can be reset after a successful upload.
    const formElement = event.currentTarget;
    setSubmitting(true); setProgress(0); setError('');
    try {
      const created = await reelApi.create({ ...form, tags: form.tags });
      const reelId = created.reel.id;
      const upload = await reelApi.createUpload(reelId, { mimeType: 'video/mp4', sizeBytes: file.size });
      await reelApi.uploadFile(upload.uploadUrl, file, upload.requiredHeaders, setProgress);
      await reelApi.completeUpload(reelId, upload.asset.id, metadata);
      if (form.publish) await reelApi.publish(reelId, upload.asset.id);
      setForm(initialForm); setFile(null); setMetadata(null); setProgress(0);
      formElement.reset();
      onToast?.(form.publish ? 'Reel uploaded and published' : 'Reel uploaded and ready');
      // Refresh the library after publish so the new item appears immediately.
      await load(reelId);
    } catch (submitError) { setError(submitError.message); }
    finally { setSubmitting(false); }
  }

  async function changeStatus(reel) {
    try {
      if (reel.status === 'published') await reelApi.disable(reel.id);
      else if (reel.status === 'disabled') await reelApi.enable(reel.id);
      else await reelApi.publish(reel.id);
      onToast?.(reel.status === 'published' ? 'Reel disabled' : 'Reel published');
      await load(reel.id);
    } catch (statusError) { setError(statusError.message); }
  }

  async function openPreview(reel) {
    try { setPreview({ ...reel, ...(await reelApi.playback(reel.id)) }); }
    catch (previewError) { setError(previewError.message); }
  }

  const maxTimelineViews = Math.max(1, ...(analytics?.timeline || []).map((item) => item.views));

  return <div className="reels-page">
    <section className="reels-hero">
      <div><span className="eyebrow">SHORT-FORM CONTENT STUDIO</span><h2>Reels that teach in seconds.</h2><p>Publish vertical health stories, manage availability and understand how every reel performs.</p></div>
      <div className="reels-hero-signal"><i/><div><span>REEL DELIVERY</span><strong>Private Wasabi media</strong><small>Signed upload and playback URLs</small></div></div>
    </section>

    <section className="reel-metrics">
      <Metric accent label="Published reels" value={reels.filter((item) => item.status === 'published').length} note={`${reels.length} total uploads`}/>
      <Metric label="Qualified views" value={compact.format(totals.views)} note="2+ seconds watched"/>
      <Metric label="Watch time" value={watchTime(totals.watchSeconds)} note="across every reel"/>
      <Metric label="Likes" value={compact.format(totals.likes)} note="current reactions"/>
    </section>

    {error && <div className="error-banner"><strong>Reel operation failed.</strong><span>{error}</span><button onClick={() => setError('')}>Dismiss</button></div>}

    <section className="reels-workspace">
      <aside className="panel reel-upload-card">
        <div className="reel-section-head"><div><span className="step">01</span><div><small>CREATE</small><h3>Upload a reel</h3></div></div></div>
        <form onSubmit={submit}>
          <label className="video-field"><span>Reel title</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength="160" placeholder="A small habit for better metabolism"/></label>
          <label className="video-field"><span>Description <em>optional</em></span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength="2200" placeholder="Add context or a short call to action"/></label>
          <label className="video-field"><span>Hashtags</span><input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="#metabolism #wellness #nutrition"/></label>
          <label className="reel-drop">
            <input type="file" accept="video/mp4,.mp4" onChange={selectFile}/>
            <span className="reel-drop-icon">＋</span><b>{file ? file.name : 'Choose vertical MP4'}</b>
            <small>{metadata ? `${metadata.width}×${metadata.height} · ${duration(metadata.durationSeconds)}` : '9:16 recommended · H.264/AAC · max 2 GB'}</small>
          </label>
          <label className="video-publish-check"><input type="checkbox" checked={form.publish} onChange={(event) => setForm({ ...form, publish: event.target.checked })}/><span><b>Publish after upload</b><small>Immediately include this reel in the app feed.</small></span></label>
          <div className="video-upload-progress"><i style={{ width: `${progress}%` }}/></div>
          <button className="save-button video-submit" disabled={submitting || !metadata}>{submitting ? `Uploading ${progress}%` : 'Upload reel'} <b>→</b></button>
        </form>
      </aside>

      <section className="panel reel-library-card">
        <div className="reel-section-head"><div><span className="step">02</span><div><small>LIBRARY</small><h3>Published & drafts</h3></div></div><button className="secondary-button" onClick={() => load()} disabled={loading}>Refresh</button></div>
        <div className="reel-library-list">
          {loading ? [...Array(4)].map((_, index) => <div className="reel-row-skeleton" key={index}/>) : reels.map((reel) => <article key={reel.id} className={`reel-library-row ${selectedId === reel.id ? 'selected' : ''}`} onClick={() => setSelectedId(reel.id)}>
            <button className="reel-thumb" onClick={(event) => { event.stopPropagation(); openPreview(reel); }} disabled={!['ready', 'published', 'disabled'].includes(reel.status)}><span>▶</span><small>{duration(reel.durationSeconds)}</small></button>
            <div className="reel-row-copy"><div><h4>{reel.title || 'Untitled reel'}</h4><span className={`reel-status ${reel.status}`}>{statusLabel(reel.status)}</span></div><p>{reel.description || 'No description added'}</p><div className="reel-tags">{(reel.tags || []).slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}</div></div>
            <div className="reel-row-stats"><span><b>{compact.format(reel.analytics?.views || 0)}</b> views</span><span><b>{compact.format(reel.analytics?.likes || 0)}</b> likes</span><span><b>{reel.analytics?.completionRate || 0}%</b> complete</span></div>
            <div className="reel-row-controls"><label className={`reel-switch ${reel.status === 'published' ? 'on' : ''}`} title={reel.status === 'published' ? 'Disable reel' : 'Enable reel'}><input type="checkbox" checked={reel.status === 'published'} disabled={!['ready', 'published', 'disabled'].includes(reel.status)} onChange={() => changeStatus(reel)} onClick={(event) => event.stopPropagation()}/><i/></label><button onClick={(event) => { event.stopPropagation(); openPreview(reel); }} disabled={!['ready', 'published', 'disabled'].includes(reel.status)}>Preview</button></div>
          </article>)}
          {!loading && !reels.length && <div className="reel-empty"><span>▯</span><strong>No reels yet</strong><p>Upload the first short-form video from the studio.</p></div>}
        </div>
      </section>
    </section>

    <section className="panel reel-analytics-card">
      <div className="reel-analytics-head"><div><span className="step">03</span><div><small>PER-REEL INSIGHTS</small><h3>{selected ? selected.title || 'Untitled reel' : 'Select a reel'}</h3></div></div><select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last year</option></select></div>
      {selected && analytics ? <>
        <div className="reel-analytics-grid">
          <div><span>Views</span><strong>{compact.format(analytics.views)}</strong><small>{compact.format(analytics.uniqueViewers)} unique viewers</small></div>
          <div><span>Completed</span><strong>{compact.format(analytics.completedViews)}</strong><small>{analytics.completionRate}% completion rate</small></div>
          <div><span>Watch time</span><strong>{analytics.totalWatchHours}h</strong><small>{watchTime(analytics.totalWatchSeconds)} total</small></div>
          <div><span>Avg. watch</span><strong>{duration(analytics.averageWatchSeconds)}</strong><small>per qualified view</small></div>
          <div><span>Likes</span><strong>{compact.format(analytics.likes)}</strong><small>current total</small></div>
          <div><span>Share clicks</span><strong>{compact.format(analytics.shareClicks)}</strong><small>share sheet opened</small></div>
        </div>
        <div className="reel-chart-wrap"><div className="reel-chart-copy"><span>VIEW ACTIVITY</span><strong>{analytics.views} qualified views</strong><small>Daily performance across the selected period</small></div><div className="reel-bars">{(analytics.timeline || []).length ? analytics.timeline.map((item) => <div key={item.date} title={`${item.date}: ${item.views} views`}><i style={{ height: `${Math.max(8, (item.views / maxTimelineViews) * 100)}%` }}/><span>{item.date.slice(5)}</span></div>) : <p>Analytics will appear after app playback events arrive.</p>}</div></div>
      </> : <div className="reel-analytics-empty">Select an uploaded reel to inspect its individual engagement.</div>}
    </section>

    {preview && <div className="video-preview-backdrop" onClick={() => setPreview(null)}><section className="reel-preview-modal" onClick={(event) => event.stopPropagation()}><div className="video-preview-header"><div><small>REEL PREVIEW</small><h2>{preview.title || 'Untitled reel'}</h2></div><button className="video-preview-close" onClick={() => setPreview(null)}>×</button></div><video controls autoPlay playsInline preload="metadata" crossOrigin="anonymous" src={preview.playbackUrl}/><div className="reel-preview-caption"><p>{preview.description || 'No description'}</p><div>{(preview.tags || []).map((tag) => <span key={tag}>#{tag}</span>)}</div></div></section></div>}
  </div>;
}
