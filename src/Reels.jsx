import { useEffect, useMemo, useRef, useState } from 'react';
import { reelApi } from './reelApi';

const initialForm = { title: '', description: '', tags: '', shareUrl: '' };
const MAX_REEL_BYTES = 200 * 1024 * 1024;
const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
const statusLabel = (value) => String(value || 'draft').replaceAll('_', ' ');
const duration = (seconds) => {
  const value = Math.max(0, Math.round(Number(seconds || 0)));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
};
const watchTime = (seconds) => Number(seconds || 0) >= 3600
  ? `${(Number(seconds) / 3600).toFixed(1)}h`
  : `${Math.round(Number(seconds || 0) / 60)}m`;
const uploadId = () => globalThis.crypto?.randomUUID?.() || `reel-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const parseTags = (value) => String(value || '').split(/[\s,]+/).map((tag) => tag.replace(/^#/, '').trim()).filter(Boolean);

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
  const [trashReels, setTrashReels] = useState([]);
  const [libraryView, setLibraryView] = useState('library');
  const [trashLoading, setTrashLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [days, setDays] = useState(30);
  const [form, setForm] = useState(initialForm);
  const [file, setFile] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadJobs, setUploadJobs] = useState([]);
  const [preview, setPreview] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(initialForm);
  const [savingEdit, setSavingEdit] = useState(false);
  const [error, setError] = useState('');
  const [processingMode, setProcessingMode] = useState('polling');
  const uploadControls = useRef(new Map());

  const selected = reels.find((item) => item.id === selectedId) || null;
  const totals = useMemo(() => reels.reduce((value, reel) => ({
    views: value.views + Number(reel.analytics?.views || 0),
    watchSeconds: value.watchSeconds + Number(reel.analytics?.totalWatchSeconds || 0),
    likes: value.likes + Number(reel.analytics?.likes || 0),
  }), { views: 0, watchSeconds: 0, likes: 0 }), [reels]);

  async function load(preferredId, { silent = false } = {}) {
    if (!silent) setLoading(true);
    if (!silent) setError('');
    try {
      const data = await reelApi.list();
      const items = data.reels || [];
      setProcessingMode(data.processingMode || 'polling');
      setReels(items);
      setUploadJobs((current) => current.filter((job) => !(
        job.status === 'processing'
        && job.completed
        && job.reelId
        && items.some((item) => item.id === job.reelId)
      )));
      setSelectedId((current) => preferredId || (items.some((item) => item.id === current) ? current : items[0]?.id || null));
      return items;
    } catch (loadError) { setError(loadError.message); return null; }
    finally { if (!silent) setLoading(false); }
  }

  async function loadTrash({ silent = false } = {}) {
    if (!silent) setTrashLoading(true);
    if (!silent) setError('');
    try {
      const data = await reelApi.list('trash');
      setTrashReels(data.reels || []);
      return data.reels || [];
    } catch (loadError) { setError(loadError.message); return null; }
    finally { if (!silent) setTrashLoading(false); }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { if (libraryView === 'trash') loadTrash(); }, [libraryView]);
  const processing = uploadJobs.some((job) => ['starting', 'uploading', 'processing'].includes(job.status))
    || reels.some((reel) => ['uploading', 'processing'].includes(reel.status));
  useEffect(() => {
    if (!processing) return undefined;
    const timer = window.setInterval(() => load(undefined, { silent: true }), 8000);
    return () => window.clearInterval(timer);
  }, [processing]);
  useEffect(() => {
    if (!selectedId) { setAnalytics(null); return; }
    reelApi.analytics(selectedId, days).then((data) => setAnalytics(data.analytics)).catch((value) => setError(value.message));
  }, [selectedId, days]);

  async function selectFile(event) {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile); setMetadata(null); setError('');
    if (!selectedFile) return;
    if (selectedFile.type && selectedFile.type !== 'video/mp4') return setError('Only MP4 reels are currently supported.');
    if (selectedFile.size > MAX_REEL_BYTES) {
      event.target.value = '';
      setFile(null);
      return setError('This reel is larger than the 200 MB upload limit.');
    }
    try { setMetadata(await readMetadata(selectedFile)); }
    catch (metadataError) { setError(metadataError.message); }
  }

  function updateUploadJob(id, values) {
    setUploadJobs((current) => current.map((job) => job.id === id ? { ...job, ...values } : job));
  }

  async function removeRemoteUpload(jobId, reelId, assetId) {
    if (!reelId) return;
    const control = uploadControls.current.get(jobId);
    if (!control) return;
    if (!control.cleanupPromise) {
      control.cleanupPromise = reelApi.cancelUpload(reelId, assetId);
    }
    return control.cleanupPromise;
  }

  async function runUpload(job, uploadFileValue, metadataValue) {
    const control = uploadControls.current.get(job.id);
    let reelId = job.reelId || null;
    let assetId = job.assetId || null;
    try {
      const created = await reelApi.create({
        title: job.title,
        description: job.description,
        tags: job.tags,
        shareUrl: job.shareUrl,
      });
      reelId = created.reel.id;
      updateUploadJob(job.id, { reelId, status: 'uploading' });
      if (control?.cancelled) {
        await removeRemoteUpload(job.id, reelId, null);
        setUploadJobs((current) => current.filter((item) => item.id !== job.id));
        uploadControls.current.delete(job.id);
        await load(undefined, { silent: true });
        return;
      }
      const upload = await reelApi.createUpload(reelId, {
        mimeType: 'video/mp4',
        sizeBytes: uploadFileValue.size,
        fileName: uploadFileValue.name,
      });
      assetId = upload.asset.id;
      updateUploadJob(job.id, { assetId });
      if (control?.cancelled) {
        await removeRemoteUpload(job.id, reelId, assetId);
        setUploadJobs((current) => current.filter((item) => item.id !== job.id));
        uploadControls.current.delete(job.id);
        await load(undefined, { silent: true });
        return;
      }
      await reelApi.uploadFile(upload.uploadUrl, uploadFileValue, upload.requiredHeaders, (value) => {
        updateUploadJob(job.id, { progress: value, status: 'uploading' });
      }, control?.controller.signal);
      if (control?.cancelled) throw Object.assign(new Error('Upload cancelled'), { name: 'AbortError' });
      updateUploadJob(job.id, { progress: 100, status: 'finalizing' });
      await reelApi.completeUpload(reelId, upload.asset.id, metadataValue);
      updateUploadJob(job.id, { progress: 100, status: 'processing', completed: true });
      onToast?.(`${job.title || 'Reel'} uploaded. Cloudflare is preparing adaptive video qualities.`);
      const items = await load(undefined, { silent: true });
      if (items?.some((item) => item.id === reelId)) {
        setUploadJobs((current) => current.filter((item) => item.id !== job.id));
      }
      uploadControls.current.delete(job.id);
    } catch (uploadError) {
      if (control?.cancelled || uploadError.name === 'AbortError') {
        try {
          await removeRemoteUpload(job.id, reelId, assetId);
          setUploadJobs((current) => current.filter((item) => item.id !== job.id));
          uploadControls.current.delete(job.id);
          await load(undefined, { silent: true });
        } catch (cancelError) {
          updateUploadJob(job.id, { reelId, assetId, status: 'failed', error: `Cancellation failed: ${cancelError.message}` });
          setError(`${job.title || 'Reel'}: cancellation failed. ${cancelError.message}`);
        }
        return;
      }
      updateUploadJob(job.id, { reelId, assetId, status: 'failed', error: uploadError.message });
      setError(`${job.title || 'Reel'}: ${uploadError.message}`);
    }
  }

  function cancelUploadJob(job) {
    const control = uploadControls.current.get(job.id);
    if (!control || control.cancelled) return;
    control.cancelled = true;
    updateUploadJob(job.id, { status: 'cancelling', error: '' });
    control.controller.abort();
  }

  async function retryUploadJob(job) {
    const previous = uploadControls.current.get(job.id);
    if (!previous?.file || !previous.metadata) return;
    updateUploadJob(job.id, { status: 'cancelling', error: '' });
    try {
      previous.cleanupPromise = null;
      await removeRemoteUpload(job.id, job.reelId, job.assetId);
      const retryJob = { ...job, reelId: null, assetId: null, progress: 0, status: 'starting', completed: false, error: '' };
      const control = { controller: new AbortController(), cancelled: false, cleanupPromise: null, file: previous.file, metadata: previous.metadata };
      uploadControls.current.set(job.id, control);
      setUploadJobs((current) => current.map((item) => item.id === job.id ? retryJob : item));
      void runUpload(retryJob, control.file, control.metadata);
    } catch (retryError) {
      previous.cleanupPromise = null;
      updateUploadJob(job.id, { status: 'failed', error: `Retry cleanup failed: ${retryError.message}` });
      setError(`${job.title || 'Reel'}: could not clean up the previous upload. ${retryError.message}`);
    }
  }

  async function dismissUploadJob(job) {
    const control = uploadControls.current.get(job.id);
    if (!control) return setUploadJobs((current) => current.filter((item) => item.id !== job.id));
    updateUploadJob(job.id, { status: 'cancelling', error: '' });
    try {
      control.cleanupPromise = null;
      await removeRemoteUpload(job.id, job.reelId, job.assetId);
      setUploadJobs((current) => current.filter((item) => item.id !== job.id));
      uploadControls.current.delete(job.id);
      await load(undefined, { silent: true });
    } catch (dismissError) {
      control.cleanupPromise = null;
      updateUploadJob(job.id, { status: 'failed', error: `Cleanup failed: ${dismissError.message}` });
    }
  }

  function submit(event) {
    event.preventDefault();
    if (!file || !metadata) return setError('Select a valid MP4 reel first.');
    if (!form.shareUrl.trim()) return setError('Add the Instagram or YouTube share link first.');
    const job = {
      id: uploadId(),
      reelId: null,
      title: form.title.trim(),
      description: form.description.trim(),
      tags: parseTags(form.tags),
      shareUrl: form.shareUrl.trim(),
      fileName: file.name,
      durationSeconds: metadata.durationSeconds,
      progress: 0,
      status: 'starting',
      assetId: null,
      completed: false,
      error: '',
    };
    const uploadFileValue = file;
    const metadataValue = metadata;

    uploadControls.current.set(job.id, {
      controller: new AbortController(),
      cancelled: false,
      cleanupPromise: null,
      file: uploadFileValue,
      metadata: metadataValue,
    });
    setUploadJobs((current) => [job, ...current]);
    setForm(initialForm);
    setFile(null);
    setMetadata(null);
    setError('');
    event.currentTarget.reset();
    void runUpload(job, uploadFileValue, metadataValue);
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

  async function trashReel(reel) {
    try {
      await reelApi.trash(reel.id);
      onToast?.('Reel moved to trash');
      await Promise.all([load(undefined, { silent: true }), loadTrash({ silent: true })]);
    } catch (trashError) { setError(trashError.message); }
  }

  async function restoreReel(reel) {
    try {
      await reelApi.restore(reel.id);
      onToast?.('Reel restored to the library');
      await Promise.all([load(undefined, { silent: true }), loadTrash({ silent: true })]);
    } catch (restoreError) { setError(restoreError.message); }
  }

  async function openPreview(reel) {
    try { setPreview({ ...reel, ...(await reelApi.playback(reel.id)) }); }
    catch (previewError) { setError(previewError.message); }
  }

  function openEdit(reel) {
    setError('');
    setEditing(reel);
    setEditForm({
      title: reel.title || '',
      description: reel.description || '',
      tags: (reel.tags || []).map((tag) => `#${tag}`).join(' '),
      shareUrl: reel.shareUrl || '',
    });
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (!editing) return;
    if (!editForm.title.trim()) return setError('Add a reel title first.');
    if (!editForm.shareUrl.trim()) return setError('Add the Instagram or YouTube share link first.');
    setSavingEdit(true); setError('');
    try {
      const response = await reelApi.update(editing.id, {
        title: editForm.title,
        description: editForm.description,
        tags: editForm.tags,
        shareUrl: editForm.shareUrl,
      });
      const updated = response.reel;
      setReels((current) => current.map((item) => item.id === updated.id
        ? { ...item, ...updated, asset: item.asset, analytics: item.analytics }
        : item));
      setPreview((current) => current?.id === updated.id ? { ...current, ...updated } : current);
      setEditing(null);
      onToast?.('Reel details updated. The uploaded video was not changed.');
    } catch (editError) { setError(editError.message); }
    finally { setSavingEdit(false); }
  }

  const maxTimelineViews = Math.max(1, ...(analytics?.timeline || []).map((item) => item.views));
  const libraryItems = libraryView === 'trash' ? trashReels : reels;
  const libraryLoading = libraryView === 'trash' ? trashLoading : loading;

  return <div className="reels-page">
    <section className="reels-hero">
      <div><span className="eyebrow">SHORT-FORM CONTENT STUDIO</span><h2>Reels that teach in seconds.</h2><p>Upload vertical health videos to Cloudflare Stream and follow their processing status from one place.</p></div>
      <div className="reels-hero-signal"><i/><div><span>REEL PROCESSING</span><strong>Cloudflare Stream</strong><small>{processingMode === 'webhook' ? 'Webhook updates with polling safety checks' : 'Automatic polling for readiness'}</small></div></div>
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
          <label className="video-field"><span>Share link <em>required · Instagram or YouTube</em></span><input type="url" required value={form.shareUrl} onChange={(event) => setForm({ ...form, shareUrl: event.target.value })} placeholder="https://www.instagram.com/reel/... or https://youtu.be/..."/></label>
          <label className="reel-drop">
            <input type="file" accept="video/mp4,.mp4" onChange={selectFile}/>
            <span className="reel-drop-icon">＋</span><b>{file ? file.name : 'Choose vertical MP4'}</b>
            <small>{metadata ? `${metadata.width}×${metadata.height} · ${duration(metadata.durationSeconds)}` : '9:16 recommended · H.264/AAC · max 200 MB'}</small>
          </label>
          <div className="video-publish-check"><span><b>Publish when ready</b><small>After Cloudflare finishes processing, use the library switch to publish the reel to the mobile feed.</small></span></div>
          <button className="save-button video-submit" disabled={!metadata || !form.shareUrl.trim()}>Upload reel <b>→</b></button>
        </form>
      </aside>

      <section className="panel reel-library-card">
        <div className="reel-section-head"><div><span className="step">02</span><div><small>LIBRARY</small><h3>{libraryView === 'trash' ? 'Trash' : 'Published & drafts'}</h3></div></div><div className="reel-library-actions"><div className="reel-library-tabs"><button className={libraryView === 'library' ? 'active' : ''} onClick={() => setLibraryView('library')}>Library</button><button className={libraryView === 'trash' ? 'active' : ''} onClick={() => setLibraryView('trash')}>Trash{trashReels.length ? ` (${trashReels.length})` : ''}</button></div><button className="secondary-button" onClick={() => libraryView === 'trash' ? loadTrash() : load()} disabled={libraryLoading}>Refresh</button></div></div>
        <div className="reel-library-list">
          {libraryLoading && !libraryItems.length && (libraryView === 'trash' || !uploadJobs.length) ? [...Array(4)].map((_, index) => <div className="reel-row-skeleton" key={index}/>) : <>
          {libraryView === 'library' && uploadJobs.map((job) => <article key={job.id} className={`reel-library-row reel-upload-job ${job.status}`}>
            <div className="reel-thumb reel-upload-job-thumb"><span>{job.status === 'failed' ? '!' : '↑'}</span><small>{duration(job.durationSeconds)}</small></div>
            <div className="reel-row-copy"><div><h4>{job.title || 'Untitled reel'}</h4><span className={`reel-status ${['starting', 'finalizing', 'cancelling'].includes(job.status) ? 'uploading' : job.status}`}>{job.status === 'starting' ? 'starting' : job.status === 'uploading' ? `uploading ${job.progress}%` : statusLabel(job.status)}</span></div><p>{job.error || (job.status === 'processing' ? 'Upload complete · Cloudflare is preparing video qualities' : job.status === 'finalizing' ? 'Upload complete · confirming with the server' : job.status === 'cancelling' ? 'Stopping upload and cleaning up' : job.fileName)}</p><div className="reel-tags">{job.tags.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}</div><div className="reel-job-progress"><i style={{ width: `${['processing', 'finalizing'].includes(job.status) ? 100 : job.progress}%` }}/></div></div>
            <div className="reel-upload-state"><b>{['processing', 'finalizing'].includes(job.status) ? '100%' : `${job.progress}%`}</b><span>{job.status === 'failed' ? 'upload failed' : job.status === 'processing' ? 'processing' : job.status === 'cancelling' ? 'cancelling' : 'uploaded'}</span></div>
            <div className="reel-row-controls reel-job-controls">{['starting', 'uploading'].includes(job.status) && <button className="danger" onClick={() => cancelUploadJob(job)}>Cancel</button>}{job.status === 'failed' && <><button onClick={() => retryUploadJob(job)}>Retry</button><button className="danger" onClick={() => dismissUploadJob(job)}>Dismiss</button></>}</div>
          </article>)}
          {libraryItems.filter((reel) => libraryView === 'trash' || !uploadJobs.some((job) => job.reelId === reel.id)).map((reel) => <article key={reel.id} className={`reel-library-row ${libraryView === 'library' && selectedId === reel.id ? 'selected' : ''}`} onClick={() => libraryView === 'library' && setSelectedId(reel.id)}>
            <button className="reel-thumb" style={reel.asset?.thumbnailUrl ? { backgroundImage: `linear-gradient(#0004,#0004), url(${reel.asset.thumbnailUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} onClick={(event) => { event.stopPropagation(); openPreview(reel); }} disabled={!['ready', 'published', 'disabled'].includes(reel.status)}><span>▶</span><small>{duration(reel.durationSeconds)}</small></button>
            <div className="reel-row-copy"><div><h4>{reel.title || 'Untitled reel'}</h4><span className={`reel-status ${reel.status}`}>{statusLabel(reel.status)}{reel.status === 'processing' && reel.asset?.processingPercent ? ` ${Math.round(reel.asset.processingPercent)}%` : ''}</span></div><p>{reel.asset?.errorMessage || reel.description || 'No description added'}</p><div className="reel-tags">{(reel.tags || []).slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}</div></div>
            <div className="reel-row-stats"><span><b>{compact.format(reel.analytics?.views || 0)}</b> views</span><span><b>{compact.format(reel.analytics?.likes || 0)}</b> likes</span><span><b>{reel.analytics?.completionRate || 0}%</b> complete</span></div>
            <div className="reel-row-controls">{libraryView === 'trash' ? <button onClick={(event) => { event.stopPropagation(); restoreReel(reel); }}>Restore</button> : <><label className={`reel-switch ${reel.status === 'published' ? 'on' : ''}`} title={reel.status === 'published' ? 'Disable reel' : reel.status === 'disabled' ? 'Enable reel' : 'Publish reel'}><input type="checkbox" checked={reel.status === 'published'} disabled={!['ready', 'published', 'disabled'].includes(reel.status)} onChange={() => changeStatus(reel)} onClick={(event) => event.stopPropagation()}/><i/></label><button onClick={(event) => { event.stopPropagation(); openEdit(reel); }}>Edit</button><button onClick={(event) => { event.stopPropagation(); openPreview(reel); }} disabled={!['ready', 'published', 'disabled'].includes(reel.status)}>Preview</button>{['draft', 'processing', 'ready', 'failed'].includes(reel.status) && <button className="danger" onClick={(event) => { event.stopPropagation(); trashReel(reel); }}>Trash</button>}</>}</div>
          </article>)}
          </>}
          {!libraryLoading && !libraryItems.length && (libraryView === 'trash' || !uploadJobs.length) && <div className="reel-empty"><span>▯</span><strong>{libraryView === 'trash' ? 'Trash is empty' : 'No reels yet'}</strong><p>{libraryView === 'trash' ? 'Unpublished reels moved to trash will appear here.' : 'Upload the first short-form video from the studio.'}</p></div>}
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

    {preview && <div className="video-preview-backdrop" onClick={() => setPreview(null)}><section className="reel-preview-modal" onClick={(event) => event.stopPropagation()}><div className="video-preview-header"><div><small>CLOUDFLARE STREAM PREVIEW</small><h2>{preview.title || 'Untitled reel'}</h2></div><button className="video-preview-close" onClick={() => setPreview(null)}>×</button></div>{preview.previewUrl ? <iframe title={`Preview ${preview.title || 'reel'}`} src={preview.previewUrl} allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen/> : <video controls autoPlay playsInline preload="metadata" crossOrigin="anonymous" src={preview.playbackUrl}/>}<div className="reel-preview-caption"><p>{preview.description || 'No description'}</p><div>{(preview.tags || []).map((tag) => <span key={tag}>#{tag}</span>)}</div></div></section></div>}
    {editing && <div className="video-preview-backdrop" onClick={() => !savingEdit && setEditing(null)}><section className="reel-edit-modal" onClick={(event) => event.stopPropagation()}><header><div><small>EDIT REEL DETAILS</small><h2>{editing.title || 'Untitled reel'}</h2><p>The Cloudflare video and upload are not editable here.</p></div><button type="button" onClick={() => setEditing(null)} disabled={savingEdit}>×</button></header><form onSubmit={saveEdit}>
      <label className="video-field"><span>Reel title</span><input required autoFocus value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} maxLength="160"/></label>
      <label className="video-field"><span>Description <em>optional</em></span><textarea value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} maxLength="2200"/></label>
      <label className="video-field"><span>Hashtags</span><input value={editForm.tags} onChange={(event) => setEditForm({ ...editForm, tags: event.target.value })} placeholder="#metabolism #wellness #nutrition"/></label>
      <label className="video-field"><span>Share link <em>required · Instagram or YouTube</em></span><input type="url" required value={editForm.shareUrl} onChange={(event) => setEditForm({ ...editForm, shareUrl: event.target.value })} placeholder="https://www.instagram.com/reel/... or https://youtu.be/..."/></label>
      <footer><button type="button" className="secondary-button" onClick={() => setEditing(null)} disabled={savingEdit}>Cancel</button><button className="save-button" disabled={savingEdit || !editForm.title.trim() || !editForm.shareUrl.trim()}>{savingEdit ? 'Saving…' : 'Save changes'} <b>→</b></button></footer>
    </form></section></div>}
  </div>;
}
