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
  slug: string; title: string; client: string;
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
const ago = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function ReviewClient({ slug, title, client, approval, latest, revisions, versions, current, images, comments }: Props) {
  const router = useRouter();
  const draftKey = `rp:draft:${current.id}`;
  const [mode, setMode] = useState<'comment' | 'view'>('comment');
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
  const [pop, setPop] = useState<{ tid: string; left: number; top: number } | null>(null);
  const [popText, setPopText] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const tw = useRef<ReactZoomPanPinchRef>(null);
  const down = useRef({ x: 0, y: 0 });

  const img = images[idx];
  const locked = approval?.version === current.number; // approved versions take no more comments
  const canApprove = !approval && current.number === latest;
  const nextRev = revisions.used + 1; // the revision this Send now would use
  const outOfRevisions = revisions.used >= revisions.included;
  const unsent = drafts.filter((d) => d.text).length;
  const roots = comments.filter((c) => !c.parentId);
  const maxPin = Math.max(0, ...roots.map((c) => c.pin ?? 0));

  useEffect(() => {
    setName(store.get('rp:name'));
    try { setDrafts(JSON.parse(store.get(draftKey) || '[]')); } catch { setDrafts([]); }
    setReady(true);
  }, [draftKey]);
  useEffect(() => { if (ready) store.set(draftKey, JSON.stringify(drafts)); }, [drafts, ready, draftKey]);

  useEffect(() => {
    const el = stageRef.current;
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

  const fit = nat && stage.w ? Math.min((stage.w - 32) / nat.w, (stage.h - 32) / nat.h, 1) : 0;
  const size = nat && fit ? { width: Math.round(nat.w * fit), height: Math.round(nat.h * fit) } : null;

  const pinned = drafts.filter((d) => d.x != null);
  const draftPin = (tid: string) => maxPin + pinned.findIndex((d) => d.tid === tid) + 1;

  function place(e: React.PointerEvent) {
    if (locked || mode !== 'comment' || !imgRef.current) return;
    if (Math.hypot(e.clientX - down.current.x, e.clientY - down.current.y) > 6) return; // it was a pan, not a tap
    const r = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    const s = stageRef.current!.getBoundingClientRect();
    const tid = uid();
    setDrafts((d) => [...d, { tid, imageId: img.id, x, y, text: '' }]);
    setPopText('');
    setPop({ tid, left: Math.min(Math.max(e.clientX - s.left + 14, 8), s.width - 296), top: Math.min(Math.max(e.clientY - s.top - 20, 8), s.height - 190) });
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
  }

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
    setDone(`Revision ${nextRev} sent (${ordered.length} comment${ordered.length === 1 ? '' : 's'})`);
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
    setTerms(false);
    setDone('Approved');
    router.refresh();
  }

  const Pin = ({ n, resolved, draft, onClick }: { n: number | string; resolved?: boolean; draft?: boolean; onClick?: () => void }) => (
    <span
      onPointerUp={(e) => e.stopPropagation()}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold text-white shadow-lg ${
        draft ? 'border-dashed border-white bg-sky-500' : resolved ? 'border-white/60 bg-zinc-500' : 'border-white bg-rose-500'
      }`}
    >{n}</span>
  );
  const pinStyle = (x: number, y: number): React.CSSProperties => ({
    position: 'absolute', left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) scale(${1 / scale})`,
  });

  const sentHere = roots.filter((c) => c.imageId === img.id && c.x != null);
  const draftsHere = drafts.filter((d) => d.imageId === img.id && d.text);
  const list = roots;

  return (
    <div className="flex h-dvh flex-col bg-black text-zinc-100">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-4 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className="truncate text-xs text-zinc-500">{client}</div>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Version" value={current.number} className="input !w-auto !py-1.5"
            onChange={(e) => router.push(`/review/${slug}?v=${e.target.value}`)}
          >
            {versions.map((v) => <option key={v.number} value={v.number}>{v.label}</option>)}
          </select>
          <div className="flex overflow-hidden rounded-lg border border-zinc-700 text-sm">
            {(['view', 'comment'] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} disabled={locked && m === 'comment'} className={`px-3 py-1.5 capitalize disabled:opacity-30 ${(locked ? 'view' : mode) === m ? 'bg-white text-black' : 'hover:bg-zinc-800'}`}>{m}</button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div ref={stageRef} className="relative min-h-0 flex-1 bg-zinc-950">
          {size && (
            <TransformWrapper
              key={img.id} ref={tw} minScale={0.5} maxScale={8} centerOnInit doubleClick={{ disabled: true }}
              onTransform={(_ref, s) => setScale(s.scale)}
            >
              <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: stage.w, height: stage.h, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div
                  style={{ position: 'relative', ...size, cursor: mode === 'comment' && !locked ? 'crosshair' : 'grab' }}
                  onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
                  onPointerUp={place}
                >
                  <img ref={imgRef} src={`/files/${img.file}`} alt={`${title}, page ${idx + 1}`} draggable={false} className="block select-none" style={size} />
                  {sentHere.map((c) => (
                    <div key={c.id} style={pinStyle(c.x!, c.y!)}><Pin n={c.pin!} resolved={c.resolved} /></div>
                  ))}
                  {draftsHere.map((d) => (
                    <div key={d.tid} style={pinStyle(d.x!, d.y!)}><Pin n={draftPin(d.tid)} draft /></div>
                  ))}
                  {pop && drafts.find((d) => d.tid === pop.tid) && (
                    <div style={pinStyle(drafts.find((d) => d.tid === pop.tid)!.x!, drafts.find((d) => d.tid === pop.tid)!.y!)}><Pin n={draftPin(pop.tid)} draft /></div>
                  )}
                </div>
              </TransformComponent>
            </TransformWrapper>
          )}
          {!size && <div className="absolute inset-0 grid place-items-center text-sm text-zinc-500">Loading design…</div>}

          <div className="absolute bottom-3 left-3 flex gap-1.5">
            <button className="btn-ghost !bg-black/70" aria-label="Zoom in" onClick={() => tw.current?.zoomIn()}>+</button>
            <button className="btn-ghost !bg-black/70" aria-label="Zoom out" onClick={() => tw.current?.zoomOut()}>−</button>
            <button className="btn-ghost !bg-black/70" onClick={() => tw.current?.resetTransform()}>Fit</button>
          </div>
          {images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-black/70 px-2 py-1 text-sm">
              <button disabled={idx === 0} onClick={() => setIdx(idx - 1)} className="px-2 disabled:opacity-30" aria-label="Previous page">‹</button>
              <span>{idx + 1} / {images.length}</span>
              <button disabled={idx === images.length - 1} onClick={() => setIdx(idx + 1)} className="px-2 disabled:opacity-30" aria-label="Next page">›</button>
            </div>
          )}

          {pop && (
            <div className="absolute z-20 w-72 rounded-xl border border-zinc-700 bg-zinc-900 p-3 shadow-2xl" style={{ left: pop.left, top: pop.top }}>
              <textarea
                autoFocus rows={3} value={popText} onChange={(e) => setPopText(e.target.value)} className="input resize-none"
                placeholder="What should change here?"
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) closePop(true); if (e.key === 'Escape') closePop(false); }}
              />
              <div className="mt-2 flex justify-end gap-2">
                <button className="btn-ghost" onClick={() => closePop(false)}>Cancel</button>
                <button className="btn" onClick={() => closePop(true)}>Add comment</button>
              </div>
            </div>
          )}
        </div>

        <aside className="flex h-[48dvh] shrink-0 flex-col border-t border-zinc-800 bg-zinc-950 lg:h-auto lg:w-[360px] lg:border-l lg:border-t-0">
          <div className="border-b border-zinc-800 p-4">
            <h2 className="font-semibold">Your comments</h2>
            {locked ? (
              <p className="mt-1 text-xs text-emerald-400">Approved. This version is closed to further comments.</p>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">Tap any part of the design to comment on it, or write a general comment below.</p>
            )}
            <div className={`mt-3 flex gap-2 ${locked ? 'hidden' : ''}`}>
              <textarea
                rows={2} value={general} onChange={(e) => setGeneral(e.target.value)} className="input resize-none" placeholder="General comment"
                aria-label="General comment"
              />
              <button className="btn-ghost self-start" onClick={addGeneral}>+ Add</button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {drafts.filter((d) => d.text).map((d) => (
              <div key={d.tid} className="rounded-lg border border-dashed border-sky-500/60 p-3 text-sm">
                <div className="mb-1 flex items-center justify-between text-xs text-sky-300">
                  <span>{d.x != null ? `#${draftPin(d.tid)} · ${d.x.toFixed(0)}%, ${d.y!.toFixed(0)}%` : 'General'} · not sent</span>
                  <button className="text-zinc-400 hover:text-white" onClick={() => setDrafts((x) => x.filter((y) => y.tid !== d.tid))} aria-label="Remove comment">Remove</button>
                </div>
                <p className="whitespace-pre-wrap">{d.text}</p>
              </div>
            ))}
            {list.map((c) => (
              <div
                key={c.id}
                className={`rounded-lg border border-zinc-800 p-3 text-sm ${c.resolved ? 'opacity-50' : ''} ${c.imageId ? 'cursor-pointer' : ''}`}
                onClick={() => { const i = images.findIndex((m) => m.id === c.imageId); if (i >= 0) setIdx(i); }}
              >
                <div className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
                  {c.pin != null && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 font-semibold text-white">{c.pin}</span>}
                  <span className="text-zinc-300">{c.author}</span>
                  <span>{ago(c.createdAt)}</span>
                  {c.x != null && <span>{c.x.toFixed(0)}%, {c.y!.toFixed(0)}%</span>}
                  {c.resolved && <span className="ml-auto text-emerald-400">Resolved</span>}
                </div>
                <p className="whitespace-pre-wrap">{c.text}</p>
                {comments.filter((r) => r.parentId === c.id).map((r) => (
                  <p key={r.id} className="mt-2 border-l-2 border-zinc-600 pl-2 text-zinc-300"><b>{r.author}:</b> {r.text}</p>
                ))}
              </div>
            ))}
            {!list.length && !drafts.length && <p className="text-sm text-zinc-600">No comments yet.</p>}
          </div>

          <div className="space-y-2 border-t border-zinc-800 p-4">
            {locked ? (
              <div className="rounded-lg border border-emerald-600/50 bg-emerald-950/40 p-3 text-sm">
                <div className="font-medium text-emerald-300">Approved by {approval!.by}</div>
                <div className="text-xs text-emerald-200/70">{ago(approval!.at)} · No further revisions can be applied to this version.</div>
              </div>
            ) : (
              <>
                <input className="input" placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
                {err && <p className="text-xs text-red-400">{err}</p>}
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Revisions</span>
                  <span className={outOfRevisions ? 'text-amber-300' : ''}>{Math.min(revisions.used, revisions.included)} of {revisions.included} used</span>
                </div>
                {outOfRevisions ? (
                  <p className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-200">
                    All {revisions.included} included revisions have been used. Please contact Reyal Design to arrange more revisions.
                  </p>
                ) : (
                  <button className="btn w-full !py-3 text-base" disabled={busy || !unsent} onClick={() => setConfirmSend(true)}>
                    {busy ? 'Sending…' : 'Send now'}
                  </button>
                )}
                {canApprove && <button className="btn-ghost w-full" onClick={openTerms}>Approve this version</button>}
              </>
            )}
          </div>
        </aside>
      </div>

      {confirmSend && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="rev-h">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
            <h2 id="rev-h" className="text-lg font-semibold">Use revision {nextRev} of {revisions.included}?</h2>
            <div className="mt-3 space-y-2 text-sm text-zinc-300">
              <p>You are about to send <b>{unsent} comment{unsent === 1 ? '' : 's'}</b>. Sending counts as one of your {revisions.included} included revisions.</p>
              <p>Please confirm this is <b>everything you need changed for revision {nextRev}</b>. Once it is sent you cannot add more to this round, and anything else will need a later revision.</p>
              {nextRev === revisions.included && <p className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-2 text-amber-200">This is your last included revision.</p>}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button className="btn-ghost" onClick={() => setConfirmSend(false)} disabled={busy}>Go back and add more</button>
              <button className="btn" onClick={send} disabled={busy}>{busy ? 'Sending…' : `Yes, send revision ${nextRev}`}</button>
            </div>
          </div>
        </div>
      )}

      {terms && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="terms-h">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
            <h2 id="terms-h" className="text-lg font-semibold">Approve this version</h2>
            <div className="mt-3 space-y-2 text-sm text-zinc-300">
              <p>By approving, you confirm that you have reviewed every page of <b>{current.label}</b> and that the design, text, images and details are correct.</p>
              <p><b>No more revisions can be applied after approval.</b> This version will be treated as final, and any later change will need to be requested as a new job.</p>
            </div>
            <input className="input mt-4" placeholder="Your full name" value={aname} onChange={(e) => setAname(e.target.value)} autoComplete="name" />
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>I have reviewed this proof and agree to these terms.</span>
            </label>
            {aerr && <p className="mt-2 text-xs text-red-400">{aerr}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setTerms(false)}>Cancel</button>
              <button className="btn" disabled={abusy || !agree || aname.trim().length < 2} onClick={approve}>{abusy ? 'Approving…' : 'Approve and finalize'}</button>
            </div>
          </div>
        </div>
      )}

      {done && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80" role="dialog" aria-live="polite">
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-8 text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-3xl text-black">✓</div>
            <div className="text-lg font-semibold">{done}</div>
            <p className="mt-1 text-sm text-zinc-400">Thank you. Reyal Design has been notified.</p>
            <button className="btn mt-5" onClick={() => setDone(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
