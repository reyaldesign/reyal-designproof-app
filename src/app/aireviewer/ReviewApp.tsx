'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AI_IMAGE_TYPES, AI_MAX_IMAGE_MB, VERDICT_LABEL, type Verdict } from '@/lib/aiShared';
import AiNav from './AiNav';
import AiStatus from './AiStatus';
import ClientIcon from './ClientIcon';
import ReviewDetail from './ReviewDetail';
import type { AiClientLite, ReviewView } from './types';

type Item = {
  id: string; file: File; url: string; status: 'pending' | 'reviewing' | 'done' | 'error'; error?: string;
  review?: ReviewView; inTok?: number; outTok?: number;
};
const uid = () => Math.random().toString(36).slice(2, 10);
type Filter = 'all' | Verdict;

/** Reads dropped files, including whole folders, keeping only supported images. */
async function filesFromDrop(dt: DataTransfer): Promise<File[]> {
  const out: File[] = [];
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      await new Promise<void>((res) => (entry as FileSystemFileEntry).file((f) => { out.push(f); res(); }, () => res()));
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res) => reader.readEntries(res, () => res([])));
        if (!batch.length) break;
        for (const e of batch) await walk(e);
      }
    }
  };
  const entries = [...dt.items].map((i) => i.webkitGetAsEntry?.()).filter((e): e is FileSystemEntry => !!e);
  if (entries.length) for (const e of entries) await walk(e);
  else out.push(...dt.files);
  return out;
}

export default function ReviewApp({ clients, keyConfigured, model, price }: { clients: AiClientLite[]; keyConfigured: boolean; model: string; price: { in: number; out: number } }) {
  const [clientId, setClientId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [criteria, setCriteria] = useState<string[]>([]);
  const [newCrit, setNewCrit] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const client = clients.find((c) => c.id === clientId);
  const category = client?.categories.find((c) => c.id === categoryId);

  // Picking a client and a category loads the criteria for that combination: the client's shared ones first, then the category's own.
  useEffect(() => {
    if (!client) { setCriteria([]); return; }
    setCriteria([...client.base.map((c) => c.text), ...(category?.criteria.map((c) => c.text) ?? [])]);
  }, [clientId, categoryId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  function addFiles(files: File[]) {
    const ok: Item[] = [];
    let skipped = 0;
    for (const f of files) {
      if (!AI_IMAGE_TYPES.includes(f.type)) { skipped++; continue; }
      const big = f.size > AI_MAX_IMAGE_MB * 1024 * 1024;
      ok.push({ id: uid(), file: f, url: URL.createObjectURL(f), status: big ? 'error' : 'pending', error: big ? `Over ${AI_MAX_IMAGE_MB} MB. Export a smaller copy.` : undefined });
    }
    if (skipped) ok.push({ id: uid(), file: new File([], `${skipped} file${skipped === 1 ? '' : 's'} skipped`), url: '', status: 'error', error: 'Only JPG, PNG, WebP and GIF images are reviewed.' });
    setItems((cur) => [...cur, ...ok]);
  }

  async function reviewOne(id: string) {
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item) return;
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, status: 'reviewing', error: undefined } : i)));
    const f = new FormData();
    f.set('file', item.file);
    f.set('criteria', JSON.stringify(criteria));
    f.set('clientId', clientId);
    f.set('categoryId', categoryId);
    const res = await fetch('/api/aireviewer/review', { method: 'POST', body: f }).catch(() => null);
    if (res?.status === 401) { window.location.href = '/login?next=/aireviewer'; return; }
    const data = res ? await res.json().catch(() => null) : null;
    if (!res?.ok || !data) {
      const msg = (data as { error?: string } | null)?.error || 'Could not reach the server. Check your connection and try again.';
      setItems((cur) => cur.map((i) => (i.id === id ? { ...i, status: 'error', error: msg } : i)));
      window.dispatchEvent(new Event('ai-status-refresh')); // a failed review: look at the AI connection again
      return;
    }
    const review: ReviewView = {
      id: data.id, imageFile: data.imageFile, filename: item.file.name, score: data.score, verdict: data.verdict,
      summary: data.summary, actionItems: data.actionItems, checks: data.checks, clientName: client?.name, categoryName: category?.name,
    };
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, status: 'done', review, inTok: data.inputTokens, outTok: data.outputTokens } : i)));
  }

  async function reviewAll() {
    if (running) return;
    setRunning(true);
    const queue = itemsRef.current.filter((i) => i.status === 'pending').map((i) => i.id);
    const worker = async () => { for (let id = queue.shift(); id; id = queue.shift()) await reviewOne(id); };
    await Promise.all([worker(), worker()]); // two at a time; the server also caps how many run at once
    setRunning(false);
  }

  const pending = items.filter((i) => i.status === 'pending').length;
  const done = items.filter((i) => i.status === 'done');
  const total = items.filter((i) => i.url).length;
  const finished = items.filter((i) => i.url && (i.status === 'done' || i.status === 'error')).length;
  const shown = items.filter((i) => i.url && (filter === 'all' || (i.status === 'done' && i.review?.verdict === filter)));
  const sel = items.find((i) => i.id === selected);
  const counts = useMemo(() => ({
    approved: done.filter((i) => i.review?.verdict === 'approved').length,
    needs_review: done.filter((i) => i.review?.verdict === 'needs_review').length,
    rejected: done.filter((i) => i.review?.verdict === 'rejected').length,
  }), [done]);
  const inTok = done.reduce((n, i) => n + (i.inTok ?? 0), 0);
  const outTok = done.reduce((n, i) => n + (i.outTok ?? 0), 0);
  const cost = (inTok / 1e6) * price.in + (outTok / 1e6) * price.out;

  return (
    <div className="page ai-page">
      <div className="page-head">
        <div>
          <h1 className="h1">AI Reviewer</h1>
          <p className="muted" style={{ marginTop: 8 }}>Check images against a checklist before they go to proofing.</p>
        </div>
        <AiNav />
      </div>

      {!keyConfigured && (
        <div className="ai-alert">The Anthropic API key is not set on this server, so reviews will fail. Add <code>ANTHROPIC_API_KEY</code> to <code>.env</code> and restart.</div>
      )}

      <div className="ai-grid">
        <aside className="ai-setup">
          <div className="ai-card">
            <label className="ai-label">Client
              <span className="ai-pick">
              {client && <ClientIcon name={client.name} logo={client.logo} size={36} />}
              <select className="input" value={clientId} onChange={(e) => { setClientId(e.target.value); setCategoryId(''); }}>
                <option value="">No client (ad hoc checklist)</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              </span>
            </label>
            {client && (
              <label className="ai-label">Image type
                <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Choose a type…</option>
                  {client.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
            {!clients.length && <p className="muted" style={{ fontSize: 12 }}>No clients yet. Add one under Clients to save a checklist per client.</p>}
          </div>

          <div className="ai-card">
            <div className="ai-h"><span>Checklist</span><span className="ai-count">{criteria.length}</span></div>
            <ul className="ai-crit">
              {criteria.map((c, i) => (
                <li key={i}><span>{c}</span><button aria-label={`Remove ${c}`} onClick={() => setCriteria((cur) => cur.filter((_, j) => j !== i))}>×</button></li>
              ))}
              {!criteria.length && <li className="empty">No criteria. The AI will judge general image quality.</li>}
            </ul>
            <form className="ai-addrow" onSubmit={(e) => { e.preventDefault(); const t = newCrit.trim(); if (t) { setCriteria((cur) => [...cur, t]); setNewCrit(''); } }}>
              <input className="input" value={newCrit} onChange={(e) => setNewCrit(e.target.value)} placeholder="Add a criterion" aria-label="Add a criterion" />
              <button className="btn">Add</button>
            </form>
            <p className="muted" style={{ fontSize: 12 }}>Changes here apply to this batch only. Save them for good under Clients.</p>
          </div>

          <div className="ai-card ai-usage">
            <div className="ai-h"><span>This session</span></div>
            <AiStatus variant="row" />
            <div><span>Reviews</span><b>{done.length}</b></div>
            <div><span>Tokens in / out</span><b>{inTok.toLocaleString()} / {outTok.toLocaleString()}</b></div>
            <div><span>Estimated cost</span><b>${cost.toFixed(3)}</b></div>
            <div><span>Model</span><b>{model}</b></div>
          </div>
        </aside>

        <section className="ai-main">
          <div
            className={`ai-drop ${over ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={async (e) => { e.preventDefault(); setOver(false); addFiles(await filesFromDrop(e.dataTransfer)); }}
          >
            <b>Drop images or a whole folder here</b>
            <small>JPG, PNG, WebP or GIF, up to {AI_MAX_IMAGE_MB} MB each</small>
            <div className="ai-droprow">
              <button className="btn" onClick={() => fileInput.current?.click()}>Choose images</button>
              <button className="btn" onClick={() => folderInput.current?.click()}>Choose a folder</button>
            </div>
            <input ref={fileInput} type="file" accept={AI_IMAGE_TYPES.join(',')} multiple hidden onChange={(e) => { addFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
            <input ref={folderInput} type="file" hidden {...({ webkitdirectory: '', directory: '' } as object)} onChange={(e) => { addFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
          </div>

          {total > 0 && (
            <div className="ai-bar">
              <button className="btn btn-primary" disabled={running || pending === 0} onClick={reviewAll}>{running ? 'Reviewing…' : pending ? `Review ${pending} image${pending === 1 ? '' : 's'}` : 'All reviewed'}</button>
              <div className="ai-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={finished}><i style={{ width: `${(finished / total) * 100}%` }} /></div>
              <span className="muted">{finished} of {total}</span>
              <button className="btn-ghost" onClick={() => { items.forEach((i) => URL.revokeObjectURL(i.url)); setItems([]); setSelected(null); }} disabled={running}>Clear</button>
            </div>
          )}

          {done.length > 0 && (
            <div className="ai-filters">
              {([['all', 'All', done.length], ['approved', 'Ready', counts.approved], ['needs_review', 'Needs revisions', counts.needs_review], ['rejected', 'Fails', counts.rejected]] as [Filter, string, number][]).map(([k, label, n]) => (
                <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{label}<span>{n}</span></button>
              ))}
            </div>
          )}

          <div className="ai-cards">
            {shown.map((i) => {
              const v = i.review && VERDICT_LABEL[i.review.verdict];
              return (
                <button key={i.id} className={`ai-tile ${selected === i.id ? 'sel' : ''}`} onClick={() => setSelected(i.id)}>
                  <span className="ai-tthumb"><img src={i.url} alt="" />{i.status === 'reviewing' && <span className="ai-spin" aria-label="Reviewing" />}</span>
                  <span className="ai-tbody">
                    <b title={i.file.name}>{i.file.name}</b>
                    {i.status === 'pending' && <span className="muted">Waiting</span>}
                    {i.status === 'reviewing' && <span className="muted">Reviewing…</span>}
                    {i.status === 'error' && <span className="ai-err">{i.error}</span>}
                    {i.review && v && <span className={`ai-verdict ${v.cls}`}>{i.review.score} · {v.short}</span>}
                  </span>
                  {i.status === 'error' && i.error && !i.error.startsWith('Over') && !i.error.startsWith('Only') && (
                    <span className="ai-retry" role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); reviewOne(i.id); }}>Retry</span>
                  )}
                </button>
              );
            })}
            {items.filter((i) => !i.url).map((i) => <div key={i.id} className="ai-note-row">{i.file.name}. {i.error}</div>)}
          </div>
          {!items.length && <p className="ai-hint">Nothing here yet. Pick a client and image type to load their checklist, then drop the images to review.</p>}
        </section>
      </div>

      {sel?.review && (
        <>
          <div className="ai-scrim" onClick={() => setSelected(null)} />
          <aside className="ai-panel" role="dialog" aria-label="Review detail">
            <div className="ai-panel-top"><span>Review</span><button onClick={() => setSelected(null)}>Close</button></div>
            <ReviewDetail r={sel.review} imageUrl={sel.url} />
          </aside>
        </>
      )}
    </div>
  );
}
