'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import FilePicker from '@/components/FilePicker';
import SubmitButton from '@/components/SubmitButton';
import { PROOF_TYPES } from '@/lib/types';
import { addVersion, deleteProject, markSent, reopenApproval, replyTo, setResolved, updateProject } from '../actions';

export type PImage = { id: string; file: string };
export type PComment = {
  id: string; imageId: string | null; parentId: string | null; author: string; text: string;
  x: number | null; y: number | null; pin: number | null; resolved: boolean; fromDesigner: boolean; createdAt: string;
};
export type PVersion = { id: string; number: number; label: string; createdAt: string; images: PImage[]; comments: PComment[] };
type Props = {
  proof: {
    id: string; slug: string; title: string; type: string | null; status: string; password: string | null; expires: string | null;
    revisionsIncluded: number | null; approvedBy: string | null; approvedAt: string | null; approvedVersion: number | null;
  };
  client: { id: string; name: string; email: string | null; revisionsIncluded: number };
  revisions: { used: number; included: number };
  versions: PVersion[]; // newest first
  link: string;
  error?: string;
};

const STEPS = ['Draft', 'Sent', 'Feedback received', 'Approved'];
const STEP_OF: Record<string, number> = { Draft: 0, Sent: 1, 'Feedback Received': 2, Approved: 3 };

const dayStamp = (iso: string) => {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? `Today ${time}` : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
};
const shortDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function ProofWorkspace({ proof, client, revisions, versions, link, error }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [vIdx, setVIdx] = useState(0);
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<'open' | 'resolved' | 'all'>('open');
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState<'send' | 'upload' | 'delete' | null>(error ? 'upload' : null);
  const [copied, setCopied] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [inc, setInc] = useState<number | null>(proof.revisionsIncluded);
  const [scale, setScale] = useState(1);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const tw = useRef<ReactZoomPanPinchRef>(null);

  const version = versions[vIdx] ?? versions[0];
  const images = version.images;
  const img = images[Math.min(page, images.length - 1)];
  const comments = version.comments;
  const roots = comments.filter((c) => !c.parentId);
  const replies = (id: string) => comments.filter((c) => c.parentId === id);
  const openN = roots.filter((c) => !c.resolved).length;
  const resolvedN = roots.length - openN;
  const stepIdx = STEP_OF[proof.status] ?? 0;
  const approvedHere = proof.approvedVersion === version.number;
  const isDraft = proof.status === 'Draft' && roots.length === 0;
  const nextV = versions[0].number + 1;
  const isFeedback = proof.status === 'Feedback Received';
  const allDone = isFeedback && roots.length > 0 && openN === 0;
  const visible = roots.filter((c) => tab === 'all' || (tab === 'open' ? !c.resolved : c.resolved));
  const type = PROOF_TYPES.find((t) => t.value === proof.type);
  const defaultInc = client.revisionsIncluded;
  const shownInc = inc ?? defaultInc;

  useEffect(() => { setModal(null); setVIdx(0); setPage(0); }, [versions.length]);
  useEffect(() => { if (error) setModal('upload'); }, [error]);
  useEffect(() => { setSel(null); setNat(null); }, [vIdx]);
  useEffect(() => {
    if (!img) return;
    setNat(null);
    const i = new Image();
    i.onload = () => setNat({ w: i.naturalWidth, h: i.naturalHeight });
    i.src = `/files/${img.file}`;
  }, [img?.file]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setDrawer(false); setModal(null); return; }
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName) || drawer || modal) return;
      if (e.key === 'ArrowLeft') setPage((p) => Math.max(0, p - 1));
      if (e.key === 'ArrowRight') setPage((p) => Math.min(images.length - 1, p + 1));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [images.length, drawer, modal]);

  const fit = nat && stage.w ? Math.min((stage.w - 48) / nat.w, (stage.h - 48) / nat.h, 1) : 0;
  const size = nat && fit ? { width: Math.round(nat.w * fit), height: Math.round(nat.h * fit) } : null;
  const pageOf = (c: PComment) => images.findIndex((m) => m.id === c.imageId);
  const pinsOnPage = (id: string) => roots.filter((c) => c.imageId === id && c.x != null).length;

  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked: the link is shown above */ }
  }
  function reply(c: PComment) {
    const text = (drafts[c.id] ?? '').trim();
    if (!text) return;
    startTransition(async () => {
      const f = new FormData(); f.set('id', c.id); f.set('text', text);
      await replyTo(f);
      setDrafts((d) => ({ ...d, [c.id]: '' }));
      router.refresh();
    });
  }
  function toggle(c: PComment) {
    startTransition(async () => {
      const f = new FormData(); f.set('id', c.id); f.set('resolved', c.resolved ? '0' : '1');
      await setResolved(f);
      router.refresh();
    });
  }
  function selectComment(c: PComment) {
    setSel(c.id);
    const p = pageOf(c);
    if (p >= 0) setPage(p);
  }

  const primary = proof.status === 'Approved' ? null
    : isFeedback ? { label: `Upload v${nextV}`, on: () => setModal('upload') }
    : { label: 'Send to client', on: () => setModal('send') };
  const mailto = `mailto:${client.email ?? ''}?subject=${encodeURIComponent(`Your proof is ready to review: ${proof.title}`)}&body=${encodeURIComponent(`Hi ${client.name},\n\nYour proof "${proof.title}" is ready. You can review it and leave comments directly on the design here:\n\n${link}\n\nThank you,\nReyal Design`)}`;
  const accessNote = [proof.password ? 'Password set' : 'No password', proof.expires ? `Expires ${proof.expires}` : 'No expiry'].join(' · ');

  return (
    <div className="pp">
      <div className="pp-top">
        <div className="pp-crumbs"><Link href="/admin">Clients</Link> / <Link href={`/admin/clients/${client.id}`}>{client.name}</Link></div>
        <div className="pp-head">
          <div>
            <div className="pp-titlerow">
              <h1 className="pp-title">{proof.title}</h1>
              {type && <span className="pp-type"><i className={`kb kt-${type.value}`}>{type.letter}</i>{type.label}</span>}
            </div>
            <div className="pp-track">
              {STEPS.map((label, i) => (
                <span key={label} style={{ display: 'contents' }}>
                  <span className={`pp-step ${i === stepIdx ? `cur s${i}` : i < stepIdx ? 'done' : ''}`}><i />{label}</span>
                  {i < STEPS.length - 1 && <span className="pp-line" />}
                </span>
              ))}
              <span className="pp-revtext">Revisions {Math.min(revisions.used, revisions.included)} of {revisions.included} used</span>
            </div>
          </div>
          <div className="pp-actions">
            <a className="pp-btn" href={link} target="_blank" rel="noreferrer">Client view ↗</a>
            <button className="pp-btn" onClick={() => setDrawer(true)}>Settings</button>
            {primary && <button className="pp-btn primary" onClick={primary.on}>{primary.label}</button>}
          </div>
        </div>
      </div>

      <div className="pp-bar">
        {versions.map((v, i) => (
          <button key={v.id} className={`pp-ver ${i === vIdx ? 'on' : ''}`} onClick={() => { setVIdx(i); setPage(0); }}>
            <b>v{v.number}</b>{v.label}<span className="meta">{shortDay(v.createdAt)} · {v.images.length} page{v.images.length === 1 ? '' : 's'}</span>
            {proof.approvedVersion === v.number && <span className="ok" title="Approved" />}
          </button>
        ))}
        <button className="pp-newver" onClick={() => setModal('upload')}>+ New version</button>
        <div className="pp-share">
          <code>{link.replace(/^https?:\/\//, '')}</code>
          <button className="pp-copy" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
        </div>
        <span className="pp-access">{accessNote}</span>
      </div>

      {proof.approvedAt && (
        <div className="pp-approved">
          <span className="dot" />
          <div>
            <b>Approved by {proof.approvedBy} · v{proof.approvedVersion}</b>
            <span className="sub">{dayStamp(proof.approvedAt)} · Terms accepted. The client can no longer comment on this version.</span>
          </div>
          <form action={reopenApproval}><input type="hidden" name="id" value={proof.id} /><button className="pp-btn">Reopen for changes</button></form>
        </div>
      )}

      <div className="pp-work">
        <nav className="pp-rail" aria-label="Pages">
          {images.map((m, i) => {
            const n = pinsOnPage(m.id);
            return (
              <button key={m.id} className={`pp-page ${i === page ? 'on' : ''}`} onClick={() => setPage(i)} aria-label={`Go to page ${i + 1}`}>
                <span className="pp-pthumb"><img src={`/files/${m.file}?w=320`} alt="" loading="lazy" />{n > 0 && <span className="n">{n}</span>}</span>
                <span className="lbl">{i + 1}</span>
              </button>
            );
          })}
        </nav>

        <section className="pp-view">
          <div ref={canvasRef} className="pp-canvas">
            {size && img && (
              <TransformWrapper key={img.id} ref={tw} minScale={0.5} maxScale={8} centerOnInit doubleClick={{ disabled: true }} onTransform={(_r, s) => setScale(s.scale)}>
                <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: stage.w, height: stage.h, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ position: 'relative', ...size, cursor: 'grab' }}>
                    <img className="pp-img" src={`/files/${img.file}`} alt={`${proof.title}, page ${page + 1}`} draggable={false} style={size} />
                    {roots.filter((c) => c.imageId === img.id && c.x != null).map((c) => (
                      <div key={c.id} className="pp-pinwrap" style={{ left: `${c.x}%`, top: `${c.y}%`, transform: `translate(-50%,-50%) scale(${1 / scale})` }}>
                        <span className={`pp-pin ${c.resolved ? 'done' : ''} ${sel === c.id ? 'sel' : ''}`} role="button" aria-label={`Comment ${c.pin}`}
                          onClick={() => { setSel(c.id); setTab(c.resolved ? 'resolved' : 'open'); }}>{c.pin}</span>
                      </div>
                    ))}
                  </div>
                </TransformComponent>
              </TransformWrapper>
            )}
            {!size && <div className="pp-loading">Loading design…</div>}
          </div>
          <div className="pp-vfoot">
            <span className="pg">Page {page + 1} of {images.length}</span>
            <span className="tip">· use ← → to move between pages</span>
            <span className="sp">
              <button className="pp-ctl" aria-label="Zoom out" onClick={() => tw.current?.zoomOut()}>−</button>
              <button className="pp-ctl" aria-label="Zoom in" onClick={() => tw.current?.zoomIn()}>+</button>
              <button className="pp-ctl txt" onClick={() => tw.current?.resetTransform()}>Fit</button>
            </span>
          </div>
        </section>

        <aside className="pp-panel" aria-label="Comments">
          {!isDraft && (
            <div className="pp-tabs" role="tablist">
              {([['open', 'Open', openN], ['resolved', 'Resolved', resolvedN], ['all', 'All', roots.length]] as const).map(([k, label, n]) => (
                <button key={k} role="tab" aria-selected={tab === k} className={`pp-tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{label}<span className="c">{n}</span></button>
              ))}
            </div>
          )}
          <div className="pp-list">
            {isDraft && (
              <>
                <div className="pp-notsent">
                  <h3>Not sent yet</h3>
                  <p>{client.name} hasn&apos;t seen this proof. Send them the link to start collecting comments. They don&apos;t need an account.</p>
                  <div className="pp-macts" style={{ justifyContent: 'flex-start', marginTop: 4 }}>
                    <button className="pp-btn primary" style={{ height: 40, fontSize: 13 }} onClick={() => setModal('send')}>Send to client</button>
                    <button className="pp-btn" style={{ height: 40 }} onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
                  </div>
                </div>
                <div className="pp-before">
                  <b>Before sending</b>
                  <span>{images.length} page{images.length === 1 ? '' : 's'} uploaded as v{version.number} · {version.label}</span>
                  <span>{shownInc} revision{shownInc === 1 ? '' : 's'} included{inc === null ? ' (client default)' : ''}</span>
                  <span>{proof.password ? 'Password protected' : 'No password'}, {proof.expires ? `expires ${proof.expires}` : 'no expiry date'}</span>
                </div>
              </>
            )}
            {!isDraft && !visible.length && (
              <div className="pp-empty">{roots.length === 0 ? 'No comments on this version yet.' : tab === 'open' ? 'Everything is resolved. Upload the next version when it’s ready.' : 'Nothing here yet.'}</div>
            )}
            {!isDraft && visible.map((c) => {
              const rs = replies(c.id);
              const p = pageOf(c);
              const file = images[p]?.file;
              const st = c.resolved ? { cls: 'done', label: 'Done' } : rs.length ? { cls: 'replied', label: 'Replied' } : { cls: 'needs', label: 'Needs team' };
              const canAct = !approvedHere;
              return (
                <div key={c.id} className={`pp-card ${sel === c.id ? 'sel' : ''} ${c.resolved ? 'done' : ''}`} onClick={() => selectComment(c)}>
                  <div className="meta">
                    <span className={`pp-pill ${c.resolved ? 'done' : ''}`}>{c.pin ?? '•'}</span>
                    <span className="who">{c.author}</span>
                    <span className="where">{p >= 0 ? `Page ${p + 1}` : 'General'} · {dayStamp(c.createdAt)}</span>
                    <span className={`pp-chip ${st.cls}`}>{st.label}</span>
                  </div>
                  {file && c.x != null && (
                    <div className="pp-crop" style={{ backgroundImage: `url(/files/${file}?w=1280)`, backgroundPosition: `${c.x}% ${c.y}%` }}>
                      <i style={{ left: `${c.x}%`, top: `${c.y}%` }} />
                    </div>
                  )}
                  <span className="pp-text">{c.text}</span>
                  {rs.map((r) => (
                    <div key={r.id} className="pp-reply">
                      <span className="av">R</span>
                      <div><b>You · {dayStamp(r.createdAt)}</b><span>{r.text}</span></div>
                    </div>
                  ))}
                  {canAct && !c.resolved && (
                    <div className="pp-row" onClick={(e) => e.stopPropagation()}>
                      <input value={drafts[c.id] ?? ''} onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))} placeholder={`Reply to ${c.author}`} aria-label={`Reply to ${c.author}`}
                        onKeyDown={(e) => { if (e.key === 'Enter') reply(c); }} />
                      <button className="pp-mini" onClick={() => reply(c)}>Reply</button>
                      <button className="pp-mini light" onClick={() => toggle(c)}>Resolve</button>
                    </div>
                  )}
                  {canAct && c.resolved && <button className="pp-reopen" onClick={(e) => { e.stopPropagation(); toggle(c); }}>Reopen</button>}
                </div>
              );
            })}
          </div>
          {isFeedback && (
            <div className="pp-pfoot">
              <div className="pp-prog">
                <span>{allDone ? 'All comments resolved' : `${resolvedN} of ${roots.length} resolved`}</span>
                <span className="segs">{roots.map((c) => <i key={c.id} className={c.resolved ? 'ok' : ''} />)}</span>
              </div>
              <button className={`pp-upload ${allDone ? 'ready' : ''}`} onClick={() => setModal('upload')}>Upload v{nextV} with these changes</button>
            </div>
          )}
        </aside>
      </div>

      {drawer && (
        <>
          <div className="pp-scrim" onClick={() => setDrawer(false)} />
          <div className="pp-drawer" role="dialog" aria-modal="true" aria-label="Proof settings">
            <form action={async (fd) => { await updateProject(fd); setDrawer(false); router.refresh(); }}>
              <input type="hidden" name="id" value={proof.id} />
              <div className="pp-dh"><h2>Proof settings</h2><button type="button" onClick={() => setDrawer(false)}>Close</button></div>
              <div className="pp-db">
                <label className="f">Title<input className="in" name="title" defaultValue={proof.title} required /></label>
                <div className="f"><span>Type</span>
                  <div className="pp-types">
                    {PROOF_TYPES.map((t) => (
                      <label key={t.value}>
                        <input type="radio" name="type" value={t.value} defaultChecked={proof.type === t.value} />
                        <span className="tile"><i className={`kb kt-${t.value}`}>{t.letter}</i>{t.label.replace(' media', '')}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="f"><span>Access</span>
                  <input className="in" name="password" defaultValue={proof.password ?? ''} placeholder="Password (optional)" />
                  <input className="in" name="expires" type="date" defaultValue={proof.expires ?? ''} aria-label="Expires (optional)" />
                </div>
                <div className="f"><span>Included revisions</span>
                  <input type="hidden" name="revisionsIncluded" value={inc ?? ''} />
                  <div className="pp-stepper">
                    <button type="button" aria-label="Fewer revisions" onClick={() => setInc(Math.max(0, shownInc - 1))}>−</button>
                    <span className="v">{shownInc}</span>
                    <button type="button" aria-label="More revisions" onClick={() => setInc(Math.min(20, shownInc + 1))}>+</button>
                    <span className="note">{inc === null ? 'Client default' : `Overrides client default of ${defaultInc}`}</span>
                    {inc !== null && <button type="button" className="link" onClick={() => setInc(null)}>Use default</button>}
                  </div>
                </div>
                <div className="pp-hint">
                  <span>Status updates on its own: <b>Sent</b> when you send the link, <b>Feedback received</b> when the client sends a revision, <b>Approved</b> when they approve.</span>
                  <details>
                    <summary>Set it by hand ▾</summary>
                    <select className="in" name="status" defaultValue={proof.status}>
                      {['Draft', 'Sent', 'Feedback Received', 'Approved'].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </details>
                </div>
                <div className="pp-danger">
                  <span>Danger zone</span>
                  <button type="button" className="pp-btn danger" onClick={() => { setDrawer(false); setModal('delete'); }}>Delete proof…</button>
                </div>
              </div>
              <div className="pp-df">
                <button type="button" className="pp-btn" onClick={() => setDrawer(false)}>Cancel</button>
                <SubmitButton className="pp-btn primary" pending="Saving…">Save settings</SubmitButton>
              </div>
            </form>
          </div>
        </>
      )}

      {modal && (
        <div className="pp-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          {modal === 'send' && (
            <div className="pp-modal">
              <h2>Send to {client.name}</h2>
              <p>They can open and comment without an account.</p>
              <div className="pp-linkbox"><code>{link}</code><button className="pp-copy" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button></div>
              <div className="pp-draftbox">
                <b>Email draft{client.email ? ` to ${client.email}` : ''}</b>
                Hi {client.name}, your proof &quot;{proof.title}&quot; is ready. You can review it and leave comments directly on the design here…
                {!client.email && <span style={{ color: 'var(--muted)' }}>No email on file. Add one with Edit client to prefill the draft.</span>}
              </div>
              <div className="pp-macts">
                <button className="pp-btn" onClick={() => setModal(null)}>Cancel</button>
                <a className="pp-btn" href={mailto}>Open email draft</a>
                <form action={markSent} onSubmit={() => setModal(null)}>
                  <input type="hidden" name="id" value={proof.id} />
                  <button className="pp-btn primary" disabled={proof.status !== 'Draft'}>{proof.status === 'Draft' ? 'Mark as sent' : `Status: ${proof.status}`}</button>
                </form>
              </div>
            </div>
          )}
          {modal === 'upload' && (
            <div className="pp-modal">
              <h2>Upload v{nextV}</h2>
              <form action={addVersion} style={{ display: 'grid', gap: 14 }}>
                <input type="hidden" name="projectId" value={proof.id} />
                <input className="in" name="label" placeholder="Label, e.g. changes #1" style={{ padding: '11px 16px', borderRadius: 99, border: '1px solid var(--line-2)', background: 'var(--surface-2)', color: 'var(--ink)', outline: 'none' }} />
                <div className="pp-drop">
                  <b>Drop images or a PDF here</b>
                  <small>JPG, PNG, WebP or GIF up to 10 MB each · PDF up to 30 MB and 60 pages · 40 MB per upload</small>
                  <FilePicker className="in" />
                </div>
                {error && <p className="pp-err">{error}</p>}
                <div className="pp-macts">
                  <button type="button" className="pp-btn" onClick={() => setModal(null)}>Cancel</button>
                  <SubmitButton className="pp-btn primary" pending="Uploading…">Upload version</SubmitButton>
                </div>
              </form>
            </div>
          )}
          {modal === 'delete' && (
            <div className="pp-modal">
              <h2>Delete &quot;{proof.title}&quot;?</h2>
              <p>This removes all versions, comments and uploaded files for this proof. The client&apos;s link stops working. This can&apos;t be undone.</p>
              <form action={deleteProject} className="pp-macts">
                <input type="hidden" name="id" value={proof.id} />
                <button type="button" className="pp-btn" onClick={() => setModal(null)}>Cancel</button>
                <SubmitButton className="pp-btn solid-danger" pending="Deleting…">Delete proof</SubmitButton>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
