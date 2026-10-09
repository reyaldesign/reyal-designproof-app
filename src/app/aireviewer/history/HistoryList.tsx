'use client';

import { useMemo, useState } from 'react';
import SubmitButton from '@/components/SubmitButton';
import { VERDICT_LABEL, type Verdict } from '@/lib/aiShared';
import AiNav from '../AiNav';
import ClientIcon from '../ClientIcon';
import ReviewDetail from '../ReviewDetail';
import { deleteAiReview, setAiVerdict } from '../actions';
import type { ReviewView } from '../types';

export type HistoryRow = ReviewView & { createdAt: string };
type Filter = 'all' | Verdict;

const dayLabel = (iso: string) => {
  const d = new Date(iso), t = new Date();
  const y = new Date();
  y.setDate(t.getDate() - 1);
  return d.toDateString() === t.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday' : d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
};

export default function HistoryList({ rows }: { rows: HistoryRow[] }) {
  const [status, setStatus] = useState<Filter>('all');
  const [client, setClient] = useState('');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const clients = useMemo(() => [...new Set(rows.map((r) => r.clientName).filter((x): x is string => !!x))].sort(), [rows]);
  const categories = useMemo(() => [...new Set(rows.filter((r) => !client || r.clientName === client).map((r) => r.categoryName).filter((x): x is string => !!x))].sort(), [rows, client]);
  const shown = rows.filter((r) => (status === 'all' || r.verdict === status) && (!client || r.clientName === client) && (!category || r.categoryName === category) && (!q.trim() || r.filename.toLowerCase().includes(q.trim().toLowerCase())));
  const groups = shown.reduce<Record<string, HistoryRow[]>>((acc, r) => { (acc[dayLabel(r.createdAt)] ??= []).push(r); return acc; }, {});
  const sel = rows.find((r) => r.id === open);

  return (
    <div className="page ai-page">
      <div className="page-head">
        <div>
          <h1 className="h1">History <span className="count">{rows.length}</span></h1>
          <p className="muted" style={{ marginTop: 8 }}>Every review is saved with the checklist it used.</p>
        </div>
        <AiNav />
      </div>

      <div className="ai-hfilters">
        <div className="segbar" role="tablist" aria-label="Filter by result">
          {([['all', 'All'], ['approved', 'Ready'], ['needs_review', 'Needs revisions'], ['rejected', 'Fails']] as [Filter, string][]).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={status === k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{label}</button>
          ))}
        </div>
        <select className="input ai-sel" value={client} onChange={(e) => { setClient(e.target.value); setCategory(''); }} aria-label="Client">
          <option value="">All clients</option>
          {clients.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="input ai-sel" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Image type">
          <option value="">All image types</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="search"><input type="search" placeholder="Search file names" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search file names" /></label>
      </div>

      {!rows.length && <div className="empty-state"><h2>No reviews yet</h2><p>Reviews you run on the AI Review page are saved here.</p></div>}
      {rows.length > 0 && !shown.length && <div className="empty-state"><p>No reviews match these filters.</p></div>}
      {Object.entries(groups).map(([day, list]) => (
        <section key={day} className="ai-day">
          <div className="section-title">{day}</div>
          <div className="ai-rows">
            {list.map((r) => {
              const v = VERDICT_LABEL[r.verdict];
              return (
                <button key={r.id} className="ai-row" onClick={() => setOpen(r.id)}>
                  <span className="ai-rthumb"><img src={`/aireviewer/img/${r.imageFile}?w=320`} alt="" loading="lazy" /></span>
                  <span className="ai-rmain"><b>{r.filename}</b><span className="muted ai-rclient">{r.clientName && <ClientIcon name={r.clientName} logo={r.clientLogo} size={16} />}{[r.clientName, r.categoryName].filter(Boolean).join(' · ') || 'No client'}</span></span>
                  <span className={`ai-verdict ${v.cls}`}>{r.score} · {v.short}</span>
                  <span className="ago">{new Date(r.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {sel && (
        <>
          <div className="ai-scrim" onClick={() => setOpen(null)} />
          <aside className="ai-panel" role="dialog" aria-label="Review detail">
            <div className="ai-panel-top"><span>Review</span><button onClick={() => setOpen(null)}>Close</button></div>
            <ReviewDetail
              r={sel}
              imageUrl={`/aireviewer/img/${sel.imageFile}`}
              footer={
                <div className="ai-foot">
                  <form action={setAiVerdict} className="ai-verdictform">
                    <input type="hidden" name="id" value={sel.id} />
                    <label>Change the result
                      <select className="input" name="verdict" defaultValue={sel.verdict} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
                        <option value="approved">Ready for proofing</option>
                        <option value="needs_review">Needs revisions</option>
                        <option value="rejected">Fails</option>
                      </select>
                    </label>
                  </form>
                  <form action={async (f) => { await deleteAiReview(f); setOpen(null); }}>
                    <input type="hidden" name="id" value={sel.id} />
                    <SubmitButton className="btn btn-danger" pending="Deleting…">Delete review</SubmitButton>
                  </form>
                </div>
              }
            />
          </aside>
        </>
      )}
    </div>
  );
}
