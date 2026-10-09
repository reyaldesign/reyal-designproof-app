'use client';

import Link from 'next/link';
import { useState } from 'react';
import { STATUS, STATUS_ORDER, type StatusKey } from '@/lib/status';
import { PROOF_TYPES } from '@/lib/types';
import ConfirmDelete from '../../ConfirmDelete';

export type ProofCard = {
  id: string; slug: string; title: string; type: string | null; status: string; version: number;
  open: number; used: number; included: number; ago: string; thumb: string | null;
};
export type ActivityRow = { kind: string; text: string; projectId: string; projectTitle: string; ago: string };

const TABS: [string, string][] = [['all', 'All'], ['Feedback Received', 'Needs review'], ['Sent', 'With client'], ['Draft', 'Draft'], ['Approved', 'Approved']];
const DOT: Record<string, string> = { revision: '#c4132f', reply: '#6aa9ff', version: '#ffd308', proof: '#ffd308', approved: '#3ddc97' };
const ACTIVITY_PREVIEW = 6;

export default function ProofBoard({ proofs, activity, base, deleteProject }: {
  proofs: ProofCard[]; activity: ActivityRow[]; base: string; deleteProject: (f: FormData) => Promise<void>;
}) {
  const [tab, setTab] = useState('all');
  const [allActivity, setAllActivity] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const shown = proofs.filter((p) => tab === 'all' || p.status === tab);
  const acts = allActivity ? activity : activity.slice(0, ACTIVITY_PREVIEW);

  async function copy(p: ProofCard) {
    try {
      await navigator.clipboard.writeText(`${base}/review/${p.slug}`);
      setCopied(p.id);
      setTimeout(() => setCopied((c) => (c === p.id ? null : c)), 1800);
    } catch { /* clipboard blocked: the link is on the proof page */ }
  }

  return (
    <>
      <div className="tabbar" role="tablist" aria-label="Filter proofs by status">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {label}<span>{k === 'all' ? proofs.length : proofs.filter((p) => p.status === k).length}</span>
          </button>
        ))}
      </div>

      <div className="board">
        <div className="proof-grid">
          {!proofs.length && <div className="empty-state"><h2>No proofs yet</h2><p>Create the first proof for this client.</p></div>}
          {proofs.length > 0 && !shown.length && <div className="empty-state"><p>No proofs with this status.</p></div>}
          {shown.map((p) => {
            const t = PROOF_TYPES.find((x) => x.value === p.type);
            const st = STATUS[(p.status in STATUS ? p.status : 'Draft') as StatusKey];
            const full = p.used >= p.included;
            return (
              <div key={p.id} className="proof-wrap">
                <div className="card-actions">
                  <button type="button" className="del-btn copy-btn" onClick={() => copy(p)} aria-label={`Copy review link for ${p.title}`} title="Copy review link">
                    {copied === p.id ? <span style={{ fontSize: 11, fontWeight: 700 }}>✓</span> : (
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
                    )}
                  </button>
                  <ConfirmDelete id={p.id} name={p.title} action={deleteProject} />
                </div>
                <Link href={`/admin/${p.id}`} className="client-card pcard">
                  <div className="cc-thumb wide">
                    {p.thumb ? <img src={p.thumb} alt="" loading="lazy" /> : <span className="cc-mono">{p.title.charAt(0)}</span>}
                    <span className="tpill"><i className={`kb ${t ? `kt-${t.value}` : ''}`}>{t?.letter ?? '?'}</i>{t?.label ?? 'No type'}</span>
                  </div>
                  <div className="cc-body">
                    <span className="cc-name">{p.title}</span>
                    <div className="pills">
                      <span className={`stpill ${st.cls}`}>{st.label}</span>
                      <span className="vlabel">v{p.version}</span>
                      {p.open > 0 && <span className="chip chip-needs">{p.open} open</span>}
                    </div>
                    <div className="revrow">
                      <span>Revisions</span>
                      <span className="rsegs">{Array.from({ length: Math.min(p.included, 10) }, (_, k) => <i key={k} className={k < p.used ? (full ? 'full' : 'used') : ''} />)}</span>
                      <span className={full ? 'full' : ''}>{Math.min(p.used, p.included)} of {p.included} used</span>
                      <span className="ago">{p.ago}</span>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>

        <aside className="act-panel" aria-label="Activity">
          <div className="act-title">Activity</div>
          {!activity.length && <p className="muted">Nothing yet. Activity shows up as proofs are created, revisions are sent and versions are approved.</p>}
          {acts.map((a, i) => (
            <Link key={i} href={`/admin/${a.projectId}`} className="act-row">
              <span className="act-dot" style={{ background: DOT[a.kind] ?? '#52525b' }} />
              <span><span className="act-text">{a.text}</span><span className="act-meta">{a.projectTitle} · {a.ago}</span></span>
            </Link>
          ))}
          {activity.length > ACTIVITY_PREVIEW && (
            <button className="act-more" onClick={() => setAllActivity(!allActivity)}>{allActivity ? 'Show less' : `Show all activity (${activity.length})`}</button>
          )}
        </aside>
      </div>
    </>
  );
}

export { STATUS_ORDER };
