'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Build, BuildInput } from '@/lib/types';
import { formatCash, formatBlockbux } from '@/lib/format';

/**
 * Admin panel: add / edit / delete builds and upload images. Rendered only
 * behind the secret URL. All write requests carry the admin API key so a leaked
 * URL alone can't modify data.
 */

type Draft = {
  name: string;
  description: string;
  category: string;
  cashPrice: string;
  blockbux: string;
  gamepasses: string[];
  images: string[];
  uploader: string;
  uploaderAvatar: string;
};

const emptyDraft: Draft = {
  name: '',
  description: '',
  category: '',
  cashPrice: '',
  blockbux: '',
  gamepasses: [],
  images: [],
  uploader: '',
  uploaderAvatar: '',
};

export default function AdminPanel({ apiKey }: { apiKey: string }) {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [gpInput, setGpInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const authHeaders = useMemo(
    () => ({ 'Content-Type': 'application/json', 'x-admin-key': apiKey }),
    [apiKey],
  );

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/builds');
      const data = await res.json();
      setBuilds(Array.isArray(data.builds) ? data.builds : []);
    } catch {
      setNotice({ type: 'err', msg: 'Failed to load builds.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function flash(type: 'ok' | 'err', msg: string) {
    setNotice({ type, msg });
    setTimeout(() => setNotice(null), 4000);
  }

  function resetForm() {
    setEditingId(null);
    setDraft(emptyDraft);
    setGpInput('');
  }

  function startEdit(b: Build) {
    setEditingId(b.id);
    setDraft({
      name: b.name,
      description: b.description,
      category: b.category,
      cashPrice: String(b.cashPrice),
      blockbux: String(b.blockbux),
      gamepasses: [...b.gamepasses],
      images: [...b.images],
      uploader: b.uploader,
      uploaderAvatar: b.uploaderAvatar ?? '',
    });
    setGpInput('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function addGamepass() {
    const v = gpInput.trim();
    if (!v) return;
    if (!draft.gamepasses.includes(v)) {
      setDraft((d) => ({ ...d, gamepasses: [...d.gamepasses, v] }));
    }
    setGpInput('');
  }

  function removeGamepass(gp: string) {
    setDraft((d) => ({ ...d, gamepasses: d.gamepasses.filter((g) => g !== gp) }));
  }

  function removeImage(url: string) {
    setDraft((d) => ({ ...d, images: d.images.filter((i) => i !== url) }));
  }

  async function onUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'x-admin-key': apiKey },
          body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        setDraft((d) => ({ ...d, images: [...d.images, data.url] }));
      }
      flash('ok', 'Image(s) uploaded.');
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  function buildPayload(): BuildInput {
    return {
      name: draft.name.trim(),
      description: draft.description.trim(),
      category: draft.category.trim(),
      cashPrice: Number(draft.cashPrice) || 0,
      blockbux: Number(draft.blockbux) || 0,
      gamepasses: draft.gamepasses,
      images: draft.images,
      uploader: draft.uploader.trim(),
      uploaderAvatar: draft.uploaderAvatar.trim() || undefined,
    };
  }

  async function save() {
    if (!draft.name.trim()) {
      flash('err', 'Please enter a build name.');
      return;
    }
    setBusy(true);
    try {
      const payload = buildPayload();
      const url = editingId ? `/api/builds/${editingId}` : '/api/builds';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: authHeaders, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      flash('ok', editingId ? 'Build updated.' : 'Build added.');
      resetForm();
      await refresh();
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/builds/${id}`, { method: 'DELETE', headers: authHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      flash('ok', 'Build deleted.');
      if (editingId === id) resetForm();
      await refresh();
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container admin-wrap">
      <div className="admin-head">
        <h1>🛠️ BloxBuilt Admin</h1>
        <a className="btn" href="/" target="_blank" rel="noreferrer">
          View site ↗
        </a>
      </div>

      {notice ? <div className={`notice ${notice.type}`}>{notice.msg}</div> : null}

      <div className="panel">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>
          {editingId ? 'Edit build' : 'Add a build'}
        </h2>

        <div className="form-grid">
          <div className="field full">
            <label>Name</label>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Cute Lil Starter House"
            />
          </div>

          <div className="field full">
            <label>Description</label>
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="idk the inside but looks nice"
            />
          </div>

          <div className="field">
            <label>Category</label>
            <input
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              placeholder="mansion"
            />
          </div>

          <div className="field">
            <label>Uploader</label>
            <input
              value={draft.uploader}
              onChange={(e) => setDraft({ ...draft, uploader: e.target.value })}
              placeholder="1SH"
            />
          </div>

          <div className="field">
            <label>Cash Price</label>
            <input
              type="number"
              min={0}
              value={draft.cashPrice}
              onChange={(e) => setDraft({ ...draft, cashPrice: e.target.value })}
              placeholder="571164"
            />
          </div>

          <div className="field">
            <label>Blockbux (B$)</label>
            <input
              type="number"
              min={0}
              value={draft.blockbux}
              onChange={(e) => setDraft({ ...draft, blockbux: e.target.value })}
              placeholder="3170"
            />
          </div>

          <div className="field full">
            <label>Uploader Avatar URL (optional)</label>
            <input
              value={draft.uploaderAvatar}
              onChange={(e) => setDraft({ ...draft, uploaderAvatar: e.target.value })}
              placeholder="https://…"
            />
          </div>

          <div className="field full">
            <label>Required Gamepasses</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={gpInput}
                onChange={(e) => setGpInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addGamepass();
                  }
                }}
                placeholder="Advanced Placement"
              />
              <button type="button" className="btn" onClick={addGamepass}>
                Add
              </button>
            </div>
            {draft.gamepasses.length ? (
              <div className="chips" style={{ marginTop: 8 }}>
                {draft.gamepasses.map((gp) => (
                  <span className="chip" key={gp}>
                    {gp}
                    <button type="button" onClick={() => removeGamepass(gp)} aria-label={`Remove ${gp}`}>
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="field full">
            <label>Images</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              onChange={(e) => onUpload(e.target.files)}
              disabled={uploading}
            />
            <span className="hint">
              {uploading ? 'Uploading…' : 'PNG, JPG, WEBP or GIF · up to 8 MB each · first image is the cover'}
            </span>
            {draft.images.length ? (
              <div className="img-tray">
                {draft.images.map((url, i) => (
                  <div className={`item ${i === 0 ? 'cover' : ''}`} key={url}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="upload" />
                    {i === 0 ? <span className="cover-tag">Cover</span> : null}
                    <button
                      type="button"
                      className="x"
                      onClick={() => removeImage(url)}
                      aria-label="Remove image"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn-primary" onClick={save} disabled={busy || uploading}>
            {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add build'}
          </button>
          {editingId ? (
            <button className="btn" onClick={resetForm} disabled={busy}>
              Cancel edit
            </button>
          ) : null}
        </div>
      </div>

      <div className="admin-list">
        <h2 style={{ fontSize: 18, margin: '6px 0' }}>
          Existing builds {loading ? '' : `(${builds.length})`}
        </h2>
        {loading ? (
          <div className="loading">
            <div className="spinner" />
            Loading…
          </div>
        ) : builds.length === 0 ? (
          <div className="muted">No builds yet — add your first one above.</div>
        ) : (
          builds.map((b) => (
            <div className="admin-row" key={b.id}>
              <div className="thumb-sm">
                {b.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.images[0]} alt={b.name} />
                ) : null}
              </div>
              <div className="meta">
                <div className="t">{b.name}</div>
                <div className="s">
                  ID {b.id} · {formatCash(b.cashPrice)} · {formatBlockbux(b.blockbux)}
                </div>
              </div>
              <div className="actions">
                <button className="btn" onClick={() => startEdit(b)} disabled={busy}>
                  Edit
                </button>
                <button className="btn btn-danger" onClick={() => remove(b.id, b.name)} disabled={busy}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
