'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AI_IMAGE_TYPES, AI_KINDS, GENERAL, AI_MAX_IMAGE_MB, KIND_RULES, isKind, type Kind, type Verdict } from '@/lib/aiShared';
import AiNav from './AiNav';
import AiStatus from './AiStatus';
import ClientIcon from './ClientIcon';
import { useLang } from './Lang';
import ReviewDetail from './ReviewDetail';
import type { AiClientLite, ReviewView } from './types';

// Website and Food Menu files are uploaded first (they can be big PDFs), then their pages are picked and reviewed as one.
type Source = { token: string; name: string; pages: number; thumbs: string[]; capped: boolean };
type Pick = { si: number; page: number };
type Item = {
  id: string; file: File; url: string; status: 'pending' | 'uploading' | 'reviewing' | 'done' | 'error'; error?: string;
  preError?: boolean; // it never got as far as a review, so there is nothing to retry
  review?: ReviewView; inTok?: number; outTok?: number;
  progress?: number;
  set?: { sources: Source[]; picks: Pick[] };
  checked?: boolean; // ticked to be combined into one review
};
const uid = () => Math.random().toString(36).slice(2, 10);
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
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
  const { t, msg, verdict } = useLang();
  const [kind, setKind] = useState<Kind>('social');
  const [pickedId, setClientId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [criteria, setCriteria] = useState<string[]>([]);
  const [newCrit, setNewCrit] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const rules = KIND_RULES[kind];
  const isSet = rules.pdf; // Website and Food Menu
  const shared = GENERAL[kind]?.id; // Website and Food Menu use one shared list, no client
  const clientId = shared ?? pickedId;
  const ownClients = clients.filter((c) => !c.general);
  const client = clients.find((c) => c.id === clientId);
  const cats = client?.categories.filter((c) => c.kind === kind) ?? [];
  const category = cats.find((c) => c.id === categoryId);

  useEffect(() => { try { const k = localStorage.getItem('ai_kind'); if (isKind(k)) setKind(k); } catch { /* storage unavailable */ } }, []);

  // Picking a client and a category loads the criteria for that combination: the client's shared ones first, then the category's own. Each review type has its own.
  useEffect(() => {
    if (!client) { setCriteria([]); return; }
    setCriteria([...client.base.filter((c) => c.kind === kind).map((c) => c.text), ...(category?.criteria.map((c) => c.text) ?? [])]);
  }, [clientId, categoryId, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  const patch = (id: string, p: Partial<Item>) => setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...p } : i)));
  function clearAll() { itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url)); setItems([]); setSelected(null); setPicking(null); }
  function chooseKind(k: Kind) {
    if (k === kind) return;
    if (items.length && !confirm(t('Switching the review type clears the current batch. Continue?'))) return;
    clearAll();
    setKind(k);
    setCategoryId('');
    try { localStorage.setItem('ai_kind', k); } catch { /* storage unavailable */ }
  }

  function addFiles(files: File[]) {
    const ok: Item[] = [];
    let skipped = 0;
    const toUpload: Item[] = [];
    for (const f of files) {
      const supported = AI_IMAGE_TYPES.includes(f.type) || (isSet && isPdf(f));
      if (!supported) { skipped++; continue; }
      const big = f.size > rules.maxFileMb * 1024 * 1024;
      if (big) { ok.push({ id: uid(), file: f, url: BLANK, status: 'error', preError: true, error: `Over ${rules.maxFileMb} MB. Export a smaller copy.` }); continue; }
      if (isSet) {
        const it: Item = { id: uid(), file: f, url: BLANK, status: 'uploading', progress: 0 };
        ok.push(it); toUpload.push(it);
      } else {
        ok.push({ id: uid(), file: f, url: URL.createObjectURL(f), status: 'pending' });
      }
    }
    if (skipped) ok.push({ id: uid(), file: new File([], String(skipped)), url: '', status: 'error', error: isSet ? 'Only PDF, JPG, PNG, WebP and GIF files are reviewed.' : 'Only JPG, PNG, WebP and GIF images are reviewed.' });
    setItems((cur) => [...cur, ...ok]);
    toUpload.forEach(upload);
  }

  /** Sends one Website or Food Menu file to the server and gets back a preview of every page. */
  function upload(item: Item) {
    const fail = (error: string) => patch(item.id, { status: 'error', error, preError: true });
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/aireviewer/upload?kind=${kind}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) patch(item.id, { progress: Math.round((e.loaded / e.total) * 100) }); };
    xhr.onerror = () => fail('Could not reach the server. Check your connection and try again.');
    xhr.onload = () => {
      if (xhr.status === 401) { window.location.href = '/login?next=/aireviewer'; return; }
      let data: (Source & { error?: string }) | null = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status !== 200 || !data?.token) return fail(data?.error || 'That file could not be read.');
      const src: Source = { token: data.token, name: item.file.name, pages: data.pages, thumbs: data.thumbs, capped: data.capped };
      const picks = Array.from({ length: Math.min(src.pages, rules.maxPages) }, (_, page) => ({ si: 0, page }));
      patch(item.id, { status: 'pending', url: src.thumbs[0] ?? BLANK, set: { sources: [src], picks }, progress: undefined });
    };
    xhr.send(item.file);
  }

  async function reviewOne(id: string) {
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item) return;
    patch(id, { status: 'reviewing', error: undefined });
    let res: Response | null;
    if (item.set) {
      res = await fetch('/api/aireviewer/review-set', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, clientId, categoryId, criteria, name: item.file.name, sources: item.set.sources.map((s) => ({ token: s.token })), picks: item.set.picks }),
      }).catch(() => null);
    } else {
      const f = new FormData();
      f.set('file', item.file);
      f.set('criteria', JSON.stringify(criteria));
      f.set('clientId', clientId);
      f.set('categoryId', categoryId);
      res = await fetch('/api/aireviewer/review', { method: 'POST', body: f }).catch(() => null);
    }
    if (res?.status === 401) { window.location.href = '/login?next=/aireviewer'; return; }
    const data = res ? await res.json().catch(() => null) : null;
    if (!res?.ok || !data) {
      const message = (data as { error?: string } | null)?.error || 'Could not reach the server. Check your connection and try again.';
      patch(id, { status: 'error', error: message });
      window.dispatchEvent(new Event('ai-status-refresh')); // a failed review: look at the AI connection again
      return;
    }
    const review: ReviewView = {
      id: data.id, imageFile: data.imageFile, filename: item.file.name, score: data.score, verdict: data.verdict,
      summary: data.summary, actionItems: data.actionItems, checks: data.checks, clientName: client?.name, categoryName: category?.name,
      kind, pages: data.pages,
    };
    patch(id, { status: 'done', review, inTok: data.inputTokens, outTok: data.outputTokens });
  }

  async function reviewAll() {
    if (running) return;
    setRunning(true);
    const queue = itemsRef.current.filter((i) => i.status === 'pending').map((i) => i.id);
    const worker = async () => { for (let id = queue.shift(); id; id = queue.shift()) await reviewOne(id); };
    await Promise.all([worker(), worker()]); // two at a time; the server also caps how many run at once
    setRunning(false);
  }

  // ----- choosing pages, and combining several files into one review -----
  const picker = items.find((i) => i.id === picking);
  const togglePick = (id: string, si: number, page: number) => {
    const it = itemsRef.current.find((i) => i.id === id);
    if (!it?.set) return;
    const has = it.set.picks.some((p) => p.si === si && p.page === page);
    if (!has && it.set.picks.length >= rules.maxPages) return;
    const picks = has ? it.set.picks.filter((p) => !(p.si === si && p.page === page)) : [...it.set.picks, { si, page }].sort((a, b) => a.si - b.si || a.page - b.page);
    patch(id, { set: { ...it.set, picks } });
  };
  const ticked = items.filter((i) => i.checked && i.set && i.status === 'pending');
  const tickedPages = ticked.reduce((n, i) => n + (i.set?.picks.length ?? 0), 0);
  function combine() {
    if (ticked.length < 2) return;
    if (tickedPages > rules.maxPages) { alert(t('A review can hold up to {n} pages. Untick some pages first.', { n: rules.maxPages })); return; }
    const sources: Source[] = [];
    const picks: Pick[] = [];
    for (const i of ticked) {
      const base = sources.length;
      sources.push(...i.set!.sources);
      picks.push(...i.set!.picks.map((p) => ({ si: p.si + base, page: p.page })));
    }
    const merged: Item = { id: uid(), file: new File([], `${ticked[0].file.name} + ${ticked.length - 1}`), url: ticked[0].url, status: 'pending', set: { sources, picks } };
    const gone = new Set(ticked.map((i) => i.id));
    setItems((cur) => { const at = cur.findIndex((i) => gone.has(i.id)); const rest = cur.filter((i) => !gone.has(i.id)); rest.splice(at, 0, merged); return rest; });
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
  const upl = items.some((i) => i.status === 'uploading');

  return (
    <div className="page ai-page">
      <div className="page-head">
        <div>
          <h1 className="h1">{t('AI Reviewer')}</h1>
          <p className="muted" style={{ marginTop: 8 }}>{t('Check images against a checklist before they go to proofing.')}</p>
        </div>
        <AiNav />
      </div>

      {!keyConfigured && (
        <div className="ai-alert">{t('The Anthropic API key is not set on this server, so reviews will fail. Add')} <code>ANTHROPIC_API_KEY</code> {t('to')} <code>.env</code> {t('and restart.')}</div>
      )}

      <div className="ai-grid">
        <aside className="ai-setup">
          <div className="ai-card">
            <div className="ai-label">{t('Review type')}
              <div className="ai-kinds" role="group" aria-label={t('Review type')}>
                {AI_KINDS.map((k) => <button key={k.key} className={kind === k.key ? 'on' : ''} aria-pressed={kind === k.key} onClick={() => chooseKind(k.key)}>{t(k.label)}</button>)}
              </div>
            </div>
            {!shared && <label className="ai-label">{t('Client')}
              <span className="ai-pick">
              {client && <ClientIcon name={client.name} logo={client.logo} size={36} />}
              <select className="input" value={clientId} onChange={(e) => { setClientId(e.target.value); setCategoryId(''); }}>
                <option value="">{t('No client (ad hoc checklist)')}</option>
                {ownClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              </span>
            </label>}
            {client && (
              <label className="ai-label">{t('Media Type')}
                <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">{t('Choose a media type…')}</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
            {client && !cats.length && <p className="muted" style={{ fontSize: 12 }}>{t('No media types for this review type yet. Add them under Review Criteria.')}</p>}
            {!shared && !ownClients.length && <p className="muted" style={{ fontSize: 12 }}>{t('No clients yet. Add one under Review Criteria to save a checklist per client.')}</p>}
          </div>

          <div className="ai-card">
            <div className="ai-h"><span>{shared ? t('{kind} criteria', { kind: t(AI_KINDS.find((k) => k.key === kind)!.label) }) : t('Checklist')}</span><span className="ai-count">{criteria.length}</span></div>
            <ul className="ai-crit">
              {criteria.map((c, i) => (
                <li key={i}><span>{c}</span><button aria-label={t('Remove {c}', { c })} onClick={() => setCriteria((cur) => cur.filter((_, j) => j !== i))}>×</button></li>
              ))}
              {!criteria.length && <li className="empty">{t('No criteria. The AI will judge general image quality.')}</li>}
            </ul>
            <form className="ai-addrow" onSubmit={(e) => { e.preventDefault(); const v = newCrit.trim(); if (v) { setCriteria((cur) => [...cur, v]); setNewCrit(''); } }}>
              <input className="input" value={newCrit} onChange={(e) => setNewCrit(e.target.value)} placeholder={t('Add a criterion')} aria-label={t('Add a criterion')} />
              <button className="btn">{t('Add')}</button>
            </form>
            <p className="muted" style={{ fontSize: 12 }}>{t('Changes here apply to this batch only. Save them for good under Review Criteria.')}</p>
          </div>

          <div className="ai-card ai-usage">
            <div className="ai-h"><span>{t('This session')}</span></div>
            <AiStatus variant="row" />
            <div><span>{t('Reviews')}</span><b>{done.length}</b></div>
            <div><span>{t('Tokens in / out')}</span><b>{inTok.toLocaleString()} / {outTok.toLocaleString()}</b></div>
            <div><span>{t('Estimated cost')}</span><b>${cost.toFixed(3)}</b></div>
            <div><span>{t('Model')}</span><b>{model}</b></div>
          </div>
        </aside>

        <section className="ai-main">
          <div
            className={`ai-drop ${over ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={async (e) => { e.preventDefault(); setOver(false); addFiles(await filesFromDrop(e.dataTransfer)); }}
          >
            <b>{isSet ? t('Drop images or PDFs here') : t('Drop images or a whole folder here')}</b>
            <small>{isSet ? t('Images and PDFs, up to {n} MB each. Maximum {p} pages per review.', { n: rules.maxFileMb, p: rules.maxPages }) : t('JPG, PNG, WebP or GIF, up to {n} MB each', { n: AI_MAX_IMAGE_MB })}</small>
            <div className="ai-droprow">
              <button className="btn" onClick={() => fileInput.current?.click()}>{isSet ? t('Choose files') : t('Choose images')}</button>
              <button className="btn" onClick={() => folderInput.current?.click()}>{t('Choose a folder')}</button>
            </div>
            <input ref={fileInput} type="file" accept={[...AI_IMAGE_TYPES, ...(isSet ? ['application/pdf'] : [])].join(',')} multiple hidden onChange={(e) => { addFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
            <input ref={folderInput} type="file" hidden {...({ webkitdirectory: '', directory: '' } as object)} onChange={(e) => { addFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
          </div>

          {total > 0 && (
            <div className="ai-bar">
              <button className="btn btn-primary" disabled={running || upl || pending === 0} onClick={reviewAll}>{running ? t('Reviewing…') : pending ? t(isSet ? (pending === 1 ? 'Review {n} file' : 'Review {n} files') : (pending === 1 ? 'Review {n} image' : 'Review {n} images'), { n: pending }) : t('All reviewed')}</button>
              {ticked.length > 1 && <button className="btn" onClick={combine}>{t('Combine {n} into one review', { n: ticked.length })}</button>}
              <div className="ai-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={finished}><i style={{ width: `${(finished / total) * 100}%` }} /></div>
              <span className="muted">{t('{a} of {b}', { a: finished, b: total })}</span>
              <button className="btn-ghost" onClick={clearAll} disabled={running}>{t('Clear')}</button>
            </div>
          )}

          {done.length > 0 && (
            <div className="ai-filters">
              {([['all', 'All', done.length], ['approved', 'Ready', counts.approved], ['needs_review', 'Needs revisions', counts.needs_review], ['rejected', 'Fails', counts.rejected]] as [Filter, string, number][]).map(([k, label, n]) => (
                <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{t(label)}<span>{n}</span></button>
              ))}
            </div>
          )}

          <div className="ai-cards">
            {shown.map((i) => {
              const v = i.review && verdict(i.review.verdict);
              const open = i.status === 'pending' || i.status === 'error';
              return (
                <div key={i.id} className="ai-tilewrap">
                  <button className={`ai-tile ${selected === i.id ? 'sel' : ''}`} onClick={() => i.status === 'done' ? setSelected(i.id) : i.set && open ? setPicking(i.id) : setSelected(i.id)}>
                    <span className="ai-tthumb"><img src={i.url} alt="" />{(i.status === 'reviewing' || i.status === 'uploading') && <span className="ai-spin" aria-label={t('Reviewing…')} />}</span>
                    <span className="ai-tbody">
                      <b title={i.file.name}>{i.file.name}</b>
                      {i.status === 'pending' && <span className="muted">{t('Waiting')}</span>}
                      {i.status === 'uploading' && <span className="muted">{t('Uploading… {n}%', { n: i.progress ?? 0 })}</span>}
                      {i.status === 'reviewing' && <span className="muted">{t('Reviewing…')}</span>}
                      {i.status === 'error' && <span className="ai-err">{msg(i.error ?? '')}</span>}
                      {i.review && v && <span className={`ai-verdict ${v.cls}`}>{i.review.score} · {v.short}</span>}
                    </span>
                    {i.status === 'error' && !i.preError && (
                      <span className="ai-retry" role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); reviewOne(i.id); }}>{t('Retry')}</span>
                    )}
                  </button>
                  {i.set && i.status !== 'uploading' && (
                    <div className="ai-tctl">
                      {i.status === 'pending' && <label className="ai-tick"><input type="checkbox" checked={!!i.checked} onChange={(e) => patch(i.id, { checked: e.target.checked })} aria-label={t('Combine into one review')} /></label>}
                      <span className="muted">{t(i.set.picks.length === 1 ? '{n} page' : '{n} pages', { n: i.set.picks.length })}</span>
                      {open && <button className="ai-link" onClick={() => setPicking(i.id)}>{t('Choose pages')}</button>}
                    </div>
                  )}
                </div>
              );
            })}
            {items.filter((i) => !i.url).map((i) => <div key={i.id} className="ai-note-row">{t(Number(i.file.name) === 1 ? '{n} file skipped' : '{n} files skipped', { n: i.file.name })}. {msg(i.error ?? '')}</div>)}
          </div>
          {!items.length && <p className="ai-hint">{t('Nothing here yet. Pick a client and media type to load their checklist, then drop the images to review.')}</p>}
        </section>
      </div>

      {sel?.review && (
        <>
          <div className="ai-scrim" onClick={() => setSelected(null)} />
          <aside className="ai-panel" role="dialog" aria-label={t('Review detail')}>
            <div className="ai-panel-top"><span>{t('Review')}</span><button onClick={() => setSelected(null)}>{t('Close')}</button></div>
            <ReviewDetail r={sel.review} imageUrl={sel.url} />
          </aside>
        </>
      )}

      {picker?.set && (
        <>
          <div className="ai-scrim" onClick={() => setPicking(null)} />
          <aside className="ai-panel" role="dialog" aria-label={t('Choose pages')}>
            <div className="ai-panel-top"><span>{t('Choose pages')}</span><button onClick={() => setPicking(null)}>{t('Close')}</button></div>
            <div className="ai-pickbar">
              <b>{t('{a} of {b} pages selected', { a: picker.set.picks.length, b: rules.maxPages })}</b>
              <button className="ai-link" onClick={() => patch(picker.id, { set: { ...picker.set!, picks: picker.set!.sources.flatMap((s, si) => Array.from({ length: Math.min(s.pages, s.thumbs.length) }, (_, page) => ({ si, page }))).slice(0, rules.maxPages) } })}>{t('Select all')}</button>
              <button className="ai-link" onClick={() => patch(picker.id, { set: { ...picker.set!, picks: [] } })}>{t('Clear selection')}</button>
            </div>
            {picker.set.sources.map((s, si) => (
              <section key={s.token} className="ai-picksrc">
                <div className="ai-picksrc-h"><b title={s.name}>{s.name}</b><span className="muted">{t(s.pages === 1 ? '{n} page' : '{n} pages', { n: s.pages })}</span></div>
                {s.capped && <p className="muted" style={{ fontSize: 12 }}>{t('Showing the first {n} pages of this PDF.', { n: s.thumbs.length })}</p>}
                <div className="ai-pickgrid">
                  {s.thumbs.map((th, page) => {
                    const on = picker.set!.picks.some((p) => p.si === si && p.page === page);
                    return (
                      <button key={page} className={`ai-pk ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => togglePick(picker.id, si, page)}>
                        <img src={th} alt="" loading="lazy" />
                        <span>{t('Page {n}', { n: page + 1 })}</span>
                        {on && <i aria-hidden="true">✓</i>}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </aside>
        </>
      )}
    </div>
  );
}
