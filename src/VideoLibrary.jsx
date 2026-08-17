import { useEffect, useMemo, useState } from 'react';
import { videoApi } from './videoApi';

const initialForm = {
  title: '', description: '', instructorName: '', category: 'yoga', level: 'all',
  audience: 'all_active_enrollments', publish: true,
};

const statusLabel = (value) => String(value || 'draft').replaceAll('_', ' ');
const minutes = (seconds) => seconds ? `${Math.max(1, Math.round(seconds / 60))} min` : 'Duration pending';
const fileSize = (bytes) => `${(Number(bytes || 0) / 1024 / 1024).toFixed(1)} MB`;

function readVideoMetadata(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const metadata = {
        durationSeconds: Number(video.duration),
        width: Number(video.videoWidth || 0),
        height: Number(video.videoHeight || 0),
      };
      URL.revokeObjectURL(objectUrl);
      if (!Number.isFinite(metadata.durationSeconds) || metadata.durationSeconds <= 0) {
        reject(new Error('The browser could not read a valid duration from this MP4.'));
        return;
      }
      resolve(metadata);
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('This file is not a browser-compatible MP4.'));
    };
    video.src = objectUrl;
  });
}

export default function VideoLibrary({ onToast }) {
  const [videos, setVideos] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [file, setFile] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  const publishedCount = useMemo(() => videos.filter((video) => video.status === 'published').length, [videos]);
  const readyCount = useMemo(() => videos.filter((video) => video.status === 'ready').length, [videos]);

  async function load() {
    setLoading(true); setError('');
    try {
      const data = await videoApi.getClasses();
      setVideos(data.videos || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function selectFile(event) {
    const selected = event.target.files?.[0] || null;
    setFile(selected); setMetadata(null); setError('');
    if (!selected) return;
    if (selected.type && selected.type !== 'video/mp4') {
      setError('Only MP4 files are supported in the basic video implementation.');
      return;
    }
    try {
      setMetadata(await readVideoMetadata(selected));
    } catch (metadataError) {
      setError(metadataError.message);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!file || !metadata) return setError('Select a valid MP4 before uploading.');
    if (!form.title.trim()) return setError('Enter a video title.');
    setSubmitting(true); setProgress(0); setError('');
    try {
      const created = await videoApi.createClass({
        title: form.title.trim(),
        description: form.description.trim(),
        instructorName: form.instructorName.trim(),
        category: form.category.trim() || 'general',
        level: form.level,
        access: { audience: form.audience, userIds: [] },
      });
      const videoClassId = created.video.id;
      const upload = await videoApi.createUpload(videoClassId, {
        mimeType: 'video/mp4', sizeBytes: file.size,
      });
      await videoApi.uploadFile(upload.uploadUrl, file, upload.requiredHeaders, setProgress);
      await videoApi.completeUpload(videoClassId, upload.asset.id, metadata);
      if (form.publish) await videoApi.publishClass(videoClassId, upload.asset.id);
      onToast?.(form.publish ? 'Video uploaded and published' : 'Video uploaded and ready');
      setForm(initialForm); setFile(null); setMetadata(null); setProgress(0);
      event.currentTarget.reset();
      await load();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function publish(video) {
    try {
      await videoApi.publishClass(video.id);
      onToast?.('Video published');
      await load();
    } catch (actionError) { setError(actionError.message); }
  }

  async function archive(video) {
    if (!window.confirm(`Archive “${video.title}”?`)) return;
    try {
      await videoApi.archiveClass(video.id);
      onToast?.('Video archived');
      await load();
    } catch (actionError) { setError(actionError.message); }
  }

  async function openPreview(video) {
    setError('');
    try {
      const playback = await videoApi.getPlaybackUrl(video.id);
      setPreview({ ...video, ...playback });
    } catch (previewError) { setError(previewError.message); }
  }

  return <div className="video-admin">
    <section className="video-metrics">
      <article className="video-metric featured"><span>Total classes</span><strong>{videos.length}</strong><small>across every status</small></article>
      <article className="video-metric"><span>Published</span><strong>{publishedCount}</strong><small>visible to entitled members</small></article>
      <article className="video-metric"><span>Ready</span><strong>{readyCount}</strong><small>uploaded but not published</small></article>
    </section>

    {error && <div className="error-banner"><strong>Video operation failed.</strong><span>{error}</span><button onClick={() => setError('')}>Dismiss</button></div>}

    <div className="video-layout">
      <section className="panel video-upload-panel">
        <div className="video-panel-heading"><div><span className="step">01</span><div><small>NEW CONTENT</small><h2>Upload a class</h2></div></div></div>
        <form onSubmit={submit}>
          <label className="video-field"><span>Class title</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength="160" placeholder="Morning yoga – Day 1" required/></label>
          <label className="video-field"><span>Description</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength="5000" placeholder="What members will learn in this class"/></label>
          <div className="video-field-row">
            <label className="video-field"><span>Instructor</span><input value={form.instructorName} onChange={(event) => setForm({ ...form, instructorName: event.target.value })} placeholder="Muditam coach"/></label>
            <label className="video-field"><span>Category</span><input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="yoga"/></label>
          </div>
          <div className="video-field-row">
            <label className="video-field"><span>Level</span><select value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })}><option value="all">All levels</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
            <label className="video-field"><span>Audience</span><select value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })}><option value="all_active_enrollments">Active enrollments</option><option value="free">All authenticated users</option></select></label>
          </div>
          <label className="video-drop">
            <input type="file" accept="video/mp4,.mp4" onChange={selectFile}/>
            <b>{file ? file.name : 'Choose an MP4 video'}</b>
            <span>{file && metadata ? `${fileSize(file.size)} · ${metadata.width}×${metadata.height} · ${minutes(metadata.durationSeconds)}` : 'H.264/AAC MP4 · maximum 2 GB'}</span>
          </label>
          <label className="video-publish-check"><input type="checkbox" checked={form.publish} onChange={(event) => setForm({ ...form, publish: event.target.checked })}/><span><b>Publish after upload</b><small>Make the class available immediately after Wasabi verification.</small></span></label>
          <div className="video-upload-progress"><i style={{ width: `${progress}%` }}/></div>
          <button className="save-button video-submit" type="submit" disabled={submitting || !file || !metadata}>{submitting ? `Uploading ${progress}%` : 'Create and upload'} <b>→</b></button>
        </form>
      </section>

      <section className="panel video-library-panel">
        <div className="video-panel-heading"><div><span className="step">02</span><div><small>WASABI LIBRARY</small><h2>Uploaded videos</h2></div></div><button className="secondary-button" onClick={load} disabled={loading}>Refresh</button></div>
        <div className="video-list">
          {loading ? [...Array(4)].map((_, index) => <div className="video-row-skeleton" key={index}/>) : videos.map((video) => <article className="video-row" key={video.id}>
            <div className="video-row-icon">▶</div>
            <div className="video-row-copy"><div><h3>{video.title}</h3><span className={`video-status ${video.status}`}>{statusLabel(video.status)}</span></div><p>{video.instructorName || 'Muditam instructor'} · {video.category} · {minutes(video.durationSeconds)}</p><small>{video.publishedAt ? `Published ${new Date(video.publishedAt).toLocaleDateString('en-IN')}` : 'Not currently published'}</small></div>
            <div className="video-row-actions">{['ready', 'published'].includes(video.status) && <button className="video-preview-button" onClick={() => openPreview(video)}>Preview</button>}{video.status === 'ready' && <button className="video-publish-button" onClick={() => publish(video)}>Publish</button>}{video.status !== 'archived' && <button className="video-archive-button" onClick={() => archive(video)}>Archive</button>}</div>
          </article>)}
          {!loading && !videos.length && <div className="video-empty"><span>▶</span><strong>No uploaded videos</strong><p>Create the first prerecorded class using the form.</p></div>}
        </div>
      </section>
    </div>
    {preview && <div className="video-preview-backdrop" role="presentation" onClick={() => setPreview(null)}>
      <section className="video-preview-modal" role="dialog" aria-modal="true" aria-label={`Preview ${preview.title}`} onClick={(event) => event.stopPropagation()}>
        <div className="video-preview-header"><div><small>PRIVATE WASABI PREVIEW</small><h2>{preview.title}</h2></div><button className="video-preview-close" onClick={() => setPreview(null)} aria-label="Close preview">×</button></div>
        <video className="video-preview-player" controls playsInline preload="metadata" crossOrigin="anonymous" src={preview.playbackUrl} />
        <p className="video-preview-note">This temporary playback link expires in {Math.round(Number(preview.expiresInSeconds || 0) / 60)} minutes.</p>
      </section>
    </div>}
  </div>;
}
