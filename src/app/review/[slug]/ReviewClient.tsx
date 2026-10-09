'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';

type C = {
  id: string; imageId: string | null; parentId: string | null; author: string; text: string;
  x: number | null; y: number | null; pin: number | null; resolved: boolean; fromDesigner: boolean; createdAt: string;
};
type Draft = { tid: string; imageId: string | null; x: number | null; y: number | null; text: string };
type Props = {
  slug: string; title: string; client: string; status: string;
  approval: { by: string; at: string; version: number } | null; latest: number;
  revisions: { used: number; included: number };
  versions: { number: number; label: string }[];
  current: { id: string; number: number; label: string };
  images: { id: string; file: string }[];
  comments: C[];
};

const store = {
  get: (k: string) => { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};
const uid = () => Math.random().toString(36).slice(2, 10);
const when = (iso: string) => (Date.now() - new Date(iso).getTime() < 60_000 ? 'Just now' : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
const plural = (n: number) => `${n} comment${n === 1 ? '' : 's'}`;

// Kept outside the main component so its identity is stable and the pop-in animation only plays when a pin first appears.
function Pin({ n, kind, x, y, scale, onClick }: { n: number | string; kind: 'open' | 'done' | 'draft' | 'new'; x: number; y: number; scale: number; onClick?: () => void }) {
  return (
    <div className="rv-pinwrap" style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) scale(${1 / scale})` }}>
      <span className={`rv-pin ${kind}`} onPointerUp={(e) => e.stopPropagation()} onClick={onClick} role="button" aria-label={`Comment ${n}`}>{n}</span>
    </div>
  );
}

export default function ReviewClient({ slug, title, client, status, approval, latest, revisions, versions, current, images, comments }: Props) {
  const router = useRouter();
  const draftKey = `rp:draft:${current.id}`;
  const [tab, setTab] = useState<'send' | 'sent'>('send');
  const [guideHidden, setGuideHidden] = useState<boolean | null>(null);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [terms, setTerms] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [agree, setAgree] = useState(false);
  const [aname, setAname] = useState('');
  const [aerr, setAerr] = useState('');
  const [abusy, setAbusy] = useState(false);
  const [idx, setIdx] = useState(0);
  const [scale, setScale] = useState(1);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [general, setGeneral] = useState('');
  const [pop, setPop] = useState<{ tid: string; left: number; top: number; flip: boolean } | null>(null);
  const [popText, setPopText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const tw = useRef<ReactZoomPanPinchRef>(null);
  const down = useRef({ x: 0, y: 0 });

  const img = images[idx];
  const locked = approval?.version === current.number; // approved versions take no more comments
  const canApprove = !approval && current.number === latest;
  const nextRev = revisions.used + 1; // the revision this Send revision would use
  const outOfRevisions = revisions.used >= revisions.included;
  const sendable = drafts.filter((d) => d.text);
  const unsent = sendable.length;
  const roots = comments.filter((c) => !c.parentId);
  const maxPin = Math.max(0, ...roots.map((c) => c.pin ?? 0));
  const pinned = drafts.filter((d) => d.x != null);
  const draftPin = (tid: string) => maxPin + pinned.findIndex((d) => d.tid === tid) + 1;
  const isLatest = current.number === latest;
  const waiting = status === 'Feedback Received' && isLatest;
  const pill = locked ? { cls: 'ok', long: 'Approved', short: 'Approved' }
    : lastSent || waiting ? { cls: 'sent', long: 'Revision sent · Reyal is working on it', short: 'Sent' }
    : { cls: 'wait', long: 'Waiting for your review', short: 'Your review' };

  useEffect(() => {
    setName(store.get('rp:name'));
    setGuideHidden(store.get('rp:guide') === 'hidden');
    try { setDrafts(JSON.parse(store.get(draftKey) || '[]')); } catch { setDrafts([]); }
    setReady(true);
  }, [draftKey]);
  useEffect(() => { if (ready) store.set(draftKey, JSON.stringify(drafts)); }, [drafts, ready, draftKey]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setNat(null);
    setPop(null);
    const i = new Image();
    i.onload = () => setNat({ w: i.naturalWidth, h: i.naturalHeight });
    i.src = `/files/${img.file}`;
  }, [img.file]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName) || confirmSend || terms) return;
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(images.length - 1, i + 1));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [images.length, confirmSend, terms]);

  const fit = nat && stage.w ? Math.min((stage.w - 48) / nat.w, (stage.h - 48) / nat.h, 1) : 0;
  const size = nat && fit ? { width: Math.round(nat.w * fit), height: Math.round(nat.h * fit) } : null;

  function place(e: React.PointerEvent) {
    if (locked || !imgRef.current || !canvasRef.current) return;
    if (Math.hypot(e.clientX - down.current.x, e.clientY - down.current.y) > 6) return; // it was a pan, not a tap
    const r = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    const s = canvasRef.current.getBoundingClientRect();
    const tid = uid();
    setDrafts((d) => [...d, { tid, imageId: img.id, x, y, text: '' }]);
    setPopText('');
    setLastSent(null);
    setTab('send');
    setPop({ tid, left: e.clientX - s.left, top: e.clientY - s.top, flip: x > 55 });
  }
  function closePop(save: boolean) {
    if (!pop) return;
    const text = popText.trim();
    setDrafts((d) => (save && text ? d.map((x) => (x.tid === pop.tid ? { ...x, text } : x)) : d.filter((x) => x.tid !== pop.tid)));
    setPop(null);
  }
  function addGeneral() {
    const text = general.trim();
    if (!text) return;
    setDrafts((d) => [...d, { tid: uid(), imageId: null, x: null, y: null, text }]);
    setGeneral('');
    setLastSent(null);
  }
  const goPage = (i: number) => { setIdx(i); setPop(null); };

  async function send() {
    setBusy(true); setErr('');
    store.set('rp:name', name);
    const ordered = [...pinned, ...drafts.filter((d) => d.x == null)].filter((d) => d.text);
    const r = await fetch(`/api/review/${slug}/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versionId: current.id, name, comments: ordered, confirmed: true }),
    }).catch(() => null);
    setBusy(false);
    setConfirmSend(false);
    if (!r?.ok) {
      const msg = ((await r?.json().catch(() => null)) as { error?: string } | null)?.error;
      return setErr(msg || 'Could not send. Check your connection and try again. Your comments are saved.');
    }
    setDrafts([]);
    setLastSent(`Revision ${nextRev} sent · ${plural(ordered.length)}`);
    setTab('sent');
    router.refresh();
  }
  function openTerms() {
    setAname(name);
    setAgree(false);
    setAerr('');
    setTerms(true);
  }
  async function approve() {
    setAbusy(true); setAerr('');
    const r = await fetch(`/api/review/${slug}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: aname, agreed: agree, versionNumber: current.number }),
    }).catch(() => null);
    setAbusy(false);
    if (!r?.ok) return setAerr(((await r?.json().catch(() => null)) as { error?: string } | null)?.error || 'Could not approve. Please try again.');
    store.set('rp:name', aname);
    setName(aname);
    setDrafts([]); // unsent comments are discarded when a version is approved
    setPop(null);
    setTerms(false);
    router.refresh();
  }
  const dismissGuide = (hide: boolean) => { setGuideHidden(hide); store.set('rp:guide', hide ? 'hidden' : 'shown'); };

  const sentHere = roots.filter((c) => c.imageId === img.id && c.x != null);
  const draftsHere = drafts.filter((d) => d.imageId === img.id && d.text);
  const newDraft = pop ? drafts.find((d) => d.tid === pop.tid) : undefined;
  const pageCount = (id: string) => roots.filter((c) => c.imageId === id && c.x != null).length + drafts.filter((d) => d.imageId === id && d.x != null && d.text).length;
  const segs = Array.from({ length: Math.min(revisions.included, 12) }, (_, k) => (k < revisions.used ? (outOfRevisions ? 'full' : 'used') : ''));
  const revLabel = `${Math.min(revisions.used, revisions.included)} of ${revisions.included} revisions used`;

  // ----- pieces shared by the desktop panel and the mobile sheet -----
  const tabs = (
    <div className="rv-tabs" role="tablist">
      {([['send', 'To send', unsent], ['sent', 'Sent', roots.length]] as const).map(([k, label, n]) => (
        <button key={k} role="tab" aria-selected={tab === k} className={`rv-tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{label}<span className="c">{n}</span></button>
      ))}
    </div>
  );

  const list = tab === 'send' ? (
    <div className="rv-list">
      {locked && (
        <div className="rv-banner" style={{ background: 'rgba(61,220,151,.1)' }}>
          <b>Approved by {approval!.by}</b><span>This version is final and closed to comments.</span>
        </div>
      )}
      {!unsent && !locked && (
        <div className="rv-empty">
          <b>{lastSent ? 'All sent' : 'No comments yet'}</b>
          <span>{lastSent ? 'Comments you add now go into the next revision.' : 'Click anywhere on the design to pin one.'}</span>
        </div>
      )}
      {sendable.map((d) => (
        <div key={d.tid} className="rv-draft">
          <div className="meta">
            <span className="rv-num">{d.x == null ? 'G' : draftPin(d.tid)}</span>
            <span>{d.x == null ? 'General · not sent' : `Page ${images.findIndex((m) => m.id === d.imageId) + 1} · not sent`}</span>
            <button className="rm" onClick={() => setDrafts((x) => x.filter((y) => y.tid !== d.tid))} aria-label="Remove comment">Remove</button>
          </div>
          <span className="rv-text">{d.text}</span>
        </div>
      ))}
      {!locked && (
        <div className="rv-general">
          <input className="rv-pill-field" value={general} onChange={(e) => setGeneral(e.target.value)} placeholder="Add a general comment" aria-label="General comment" onKeyDown={(e) => { if (e.key === 'Enter') addGeneral(); }} />
          <button className="rv-ghost" onClick={addGeneral}>Add</button>
        </div>
      )}
    </div>
  ) : (
    <div className="rv-list">
      {!roots.length && <div className="rv-empty"><b>Nothing sent yet</b><span>Comments you send show up here, with replies from Reyal Design.</span></div>}
      {roots.map((c) => {
        const replies = comments.filter((r) => r.parentId === c.id);
        const page = images.findIndex((m) => m.id === c.imageId);
        const st = c.resolved ? { cls: 'done', label: 'Done' } : replies.length ? { cls: 'replied', label: 'Replied' } : { cls: 'with', label: 'With Reyal' };
        return (
          <div key={c.id} className={`rv-sent ${page >= 0 ? 'go' : ''}`} role={page >= 0 ? 'button' : undefined} tabIndex={page >= 0 ? 0 : undefined}
            onClick={() => { if (page >= 0) goPage(page); }}
            onKeyDown={(e) => { if (page >= 0 && e.key === 'Enter') goPage(page); }}>
            <div className="meta">
              <span className={`rv-pinpill ${c.resolved ? 'done' : ''}`}>{c.pin ?? '•'}</span>
              <span className="who">{c.author}</span>
              <span>{page >= 0 ? `Page ${page + 1}` : 'General'} · {when(c.createdAt)}</span>
              <span className={`rv-chip ${st.cls}`}>{st.label}</span>
            </div>
            <span className="rv-text">{c.text}</span>
            {replies.map((r) => (
              <div key={r.id} className="rv-reply">
                <span className="av">R</span>
                <div><b>Reyal Design</b><span className="t">{r.text}</span></div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );

  const foot = (
    <div className="rv-foot">
      {lastSent && (
        <div className="rv-banner" role="status">
          <b>{lastSent}</b>
          <span>Reyal Design has been notified. You&apos;ll get an email when the next version is ready.</span>
        </div>
      )}
      {!locked && (
        <>
          <div className="rv-meter">
            <span>Revisions</span>
            <span className="segs">{segs.map((s, k) => <span key={k} className={`seg ${s}`} />)}</span>
            <span className={`lbl ${outOfRevisions ? 'full' : ''}`}>{revLabel}</span>
          </div>
          {err && <p className="rv-err">{err}</p>}
          {outOfRevisions ? (
            <div className="rv-warn">All {revisions.included} included revisions have been used. Contact Reyal Design to arrange more.</div>
          ) : (
            <button className="rv-send" disabled={busy || !unsent} onClick={() => setConfirmSend(true)}>
              {busy ? 'Sending…' : `Send revision ${nextRev}${unsent ? ` · ${plural(unsent)}` : ''}`}
            </button>
          )}
          {canApprove && <button className="rv-approve" onClick={openTerms}><i />Approve v{current.number} as final</button>}
        </>
      )}
    </div>
  );

  const pageThumb = (m: { id: string; file: string }, n: number) => {
    const count = pageCount(m.id);
    return (
      <button key={m.id} className={`rv-page ${n === idx ? 'on' : ''}`} onClick={() => goPage(n)} aria-label={`Go to page ${n + 1}`}>
        <span className="rv-thumb">
          <img src={`/files/${m.file}?w=320`} alt="" loading="lazy" />
          {count > 0 && <span className="rv-pins">{count}</span>}
        </span>
        <span className="n">Page {n + 1}</span>
      </button>
    );
  };

  return (
    <div className="review">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Urbanist:wght@400;500;600;700;800&display=swap" />

      <header className="rv-head">
        <span className="rv-mark">R</span>
        <div className="rv-titles">
          <span className="rv-title">{title}</span>
          <span className="rv-sub"><span className="desk">{client} · shared by Reyal Design</span><span className="mob">v{current.number}{isLatest ? ' · Latest' : ''} · Page {idx + 1} of {images.length}</span></span>
        </div>
        <div className="rv-head-right">
          <span className={`rv-status ${pill.cls}`}><span className="long">{pill.long}</span><span className="short">{pill.short}</span></span>
          <label className="rv-version">
            <span className="vlong">{versions.find((v) => v.number === current.number)?.label ?? `v${current.number}`}</span><span className="vshort">v{current.number}</span>
            {isLatest && <span className="latest">Latest</span>}
            <span className="caret">▾</span>
            <select aria-label="Version" value={current.number} onChange={(e) => router.push(`/review/${slug}?v=${e.target.value}`)}>
              {versions.map((v) => <option key={v.number} value={v.number}>{v.label}{v.number === latest ? ' (latest)' : ''}</option>)}
            </select>
          </label>
          <button className="rv-help" onClick={() => dismissGuide(!guideHidden)} aria-label="How to review" title="How to review">?</button>
        </div>
      </header>

      <div className={`rv-body ${images.length > 1 ? '' : 'single'}`}>
        {images.length > 1 && <nav className="rv-rail" aria-label="Pages">{images.map(pageThumb)}</nav>}

        <section className="rv-stage">
          {guideHidden === false && (
            <div className="rv-guide" role="note">
              <b>How to review</b>
              <span className="step"><i>1</i>Click to pin a comment</span>
              <span className="step"><i>2</i>Add all your changes</span>
              <span className="step"><i>3</i>Send as one revision, or approve</span>
              <button className="gotit" onClick={() => dismissGuide(true)}>Got it</button>
            </div>
          )}
          <div ref={canvasRef} className="rv-canvas">
            {size && (
              <TransformWrapper
                key={img.id} ref={tw} minScale={0.5} maxScale={8} centerOnInit doubleClick={{ disabled: true }}
                onTransform={(_ref, s) => setScale(s.scale)}
              >
                <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: stage.w, height: stage.h, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div
                    style={{ position: 'relative', ...size, cursor: locked ? 'grab' : 'crosshair' }}
                    onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
                    onPointerUp={place}
                  >
                    <img ref={imgRef} className="rv-img" src={`/files/${img.file}`} alt={`${title}, page ${idx + 1}`} draggable={false} style={size} />
                    {sentHere.map((c) => (
                      <Pin key={c.id} n={c.pin!} kind={c.resolved ? 'done' : 'open'} x={c.x!} y={c.y!} scale={scale} onClick={() => setTab('sent')} />
                    ))}
                    {draftsHere.map((d) => (
                      <Pin key={d.tid} n={draftPin(d.tid)} kind="draft" x={d.x!} y={d.y!} scale={scale} onClick={() => setTab('send')} />
                    ))}
                    {newDraft && <Pin key={`new-${newDraft.tid}`} n={draftPin(newDraft.tid)} kind="new" x={newDraft.x!} y={newDraft.y!} scale={scale} />}
                  </div>
                </TransformComponent>
              </TransformWrapper>
            )}
            {!size && <div className="rv-loading">Loading design…</div>}
            <div className="rv-mobhint">{locked ? 'Approved · view only' : 'Tap the design to comment'}</div>

            <div className="rv-controls">
              <button className="rv-ctl" aria-label="Zoom in" onClick={() => tw.current?.zoomIn()}>+</button>
              <button className="rv-ctl" aria-label="Zoom out" onClick={() => tw.current?.zoomOut()}>−</button>
              <button className="rv-ctl txt" onClick={() => tw.current?.resetTransform()}>Fit</button>
            </div>
            <div className="rv-hint">{locked ? 'Approved · view only' : `Page ${idx + 1} of ${images.length} · click to comment`}</div>

            {pop && newDraft && (
              <div
                className="rv-pop"
                style={{
                  left: Math.min(Math.max(pop.flip ? pop.left - 300 - 22 : pop.left + 22, 8), Math.max(8, stage.w - 308)),
                  top: Math.min(Math.max(pop.top - 24, 8), Math.max(8, stage.h - 200)),
                }}
              >
                <div className="hd"><span className="rv-num">{draftPin(pop.tid)}</span>New comment</div>
                <textarea
                  autoFocus rows={3} value={popText} onChange={(e) => setPopText(e.target.value)} placeholder="What should change here?"
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) closePop(true); if (e.key === 'Escape') closePop(false); }}
                />
                <div className="rv-actions">
                  <button className="rv-ghost" onClick={() => closePop(false)}>Cancel</button>
                  <button className="rv-light" onClick={() => closePop(true)}>Add comment</button>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="rv-panel" aria-label="Comments">
          {tabs}
          {list}
          {foot}
        </aside>

        {/* mobile bottom sheet */}
        <div className="rv-sheet">
          <button className="rv-handle" onClick={() => setSheet(!sheet)} aria-label={sheet ? 'Collapse comments' : 'Expand comments'} aria-expanded={sheet} />
          <div className="rv-sheet-row">
            <b>Your comments</b>
            <span>{locked ? 'Closed' : unsent ? `${unsent} to send` : 'None to send'}</span>
            <span className="rev" style={{ color: outOfRevisions ? 'var(--yellow)' : undefined }}>{revLabel}</span>
          </div>
          {sheet ? (
            <>
              {images.length > 1 && <div className="rv-strip">{images.map(pageThumb)}</div>}
              {tabs}
              {list}
              {foot}
            </>
          ) : (
            <>
              {sendable[0] && (
                <div className="rv-first">
                  <span className="rv-num">{sendable[0].x == null ? 'G' : draftPin(sendable[0].tid)}</span>
                  <span className="tx">{sendable[0].text}</span>
                </div>
              )}
              {lastSent && <div className="rv-banner"><b>{lastSent}</b></div>}
              {locked ? (
                <div className="rv-banner"><b>Approved by {approval!.by}</b></div>
              ) : (
                <div className="btns">
                  {outOfRevisions ? (
                    <div className="rv-warn">All {revisions.included} revisions used. Contact Reyal Design.</div>
                  ) : (
                    <button className="rv-send" disabled={busy || !unsent} onClick={() => setConfirmSend(true)}>{`Send revision ${nextRev}${unsent ? ` (${unsent})` : ''}`}</button>
                  )}
                  {canApprove && <button className="rv-approve" onClick={openTerms}>Approve</button>}
                </div>
              )}
              {err && <p className="rv-err">{err}</p>}
            </>
          )}
        </div>
      </div>

      {confirmSend && (
        <div className="rv-overlay" role="dialog" aria-modal="true" aria-labelledby="rev-h" onKeyDown={(e) => { if (e.key === 'Escape' && !busy) setConfirmSend(false); }}>
          <div className="rv-modal">
            <h2 id="rev-h">Send revision {nextRev} of {revisions.included}?</h2>
            <p>You&apos;re sending <b>{plural(unsent)}</b>. Make sure this is everything you want changed in this round. Anything you add later goes into the next revision.</p>
            {nextRev === revisions.included && <div className="rv-warn">This is your last included revision.</div>}
            <input className="rv-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" aria-label="Your name" />
            <div className="rv-actions">
              <button className="rv-ghost" onClick={() => setConfirmSend(false)} disabled={busy}>Keep editing</button>
              <button className="rv-primary" onClick={send} disabled={busy}>{busy ? 'Sending…' : `Send revision ${nextRev}`}</button>
            </div>
          </div>
        </div>
      )}

      {terms && (
        <div className="rv-overlay" role="dialog" aria-modal="true" aria-labelledby="terms-h" onKeyDown={(e) => { if (e.key === 'Escape' && !abusy) setTerms(false); }}>
          <div className="rv-modal wide">
            <h2 id="terms-h">Approve v{current.number} as final</h2>
            <p>You confirm you&apos;ve reviewed every page and that the design, text, images and details are correct. <b>No more revisions can be made after approval.</b> Later changes become a new job.</p>
            {unsent > 0 && <div className="rv-warn">You have {plural(unsent)} you haven&apos;t sent. They&apos;ll be discarded if you approve.</div>}
            <input className="rv-field" value={aname} onChange={(e) => setAname(e.target.value)} placeholder="Your full name" autoComplete="name" aria-label="Your full name" />
            <label className="rv-check">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <i>{agree ? '✓' : ''}</i>
              I&apos;ve reviewed this proof and agree to these terms.
            </label>
            {aerr && <p className="rv-err">{aerr}</p>}
            <div className="rv-actions">
              <button className="rv-ghost" onClick={() => setTerms(false)} disabled={abusy}>Cancel</button>
              <button className="rv-go" disabled={abusy || !agree || aname.trim().length < 2} onClick={approve}>{abusy ? 'Approving…' : 'Approve and finalize'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
