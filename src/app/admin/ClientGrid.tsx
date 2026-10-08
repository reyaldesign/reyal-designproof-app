'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import SubmitButton from '@/components/SubmitButton';
import { createClient } from './actions';

export type ClientCard = { id: string; name: string; thumb: string | null; open: number; dots: { letter: string; cls: string; title: string }[]; ago: string };

export default function ClientGrid({ clients, error }: { clients: ClientCard[]; error?: string }) {
  const [q, setQ] = useState('');
  const dlg = useRef<HTMLDialogElement>(null);
  const shown = clients.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Reyal Proof</div>
          <h1 className="h1">Clients <span className="count">{clients.length}</span></h1>
        </div>
        <div className="head-actions">
          <label className="search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search clients" />
          </label>
          <button className="btn btn-primary" onClick={() => dlg.current?.showModal()}>+ Add client</button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm" style={{ color: 'var(--bad)' }}>{error}</p>}

      <div className="client-grid">
        {!clients.length && (
          <div className="empty-state"><h2>No clients yet</h2><p>Add your first client to start sharing proofs.</p></div>
        )}
        {clients.length > 0 && !shown.length && <div className="empty-state"><p>No clients match &ldquo;{q}&rdquo;.</p></div>}
        {shown.map((c) => (
          <Link key={c.id} href={`/admin/clients/${c.id}`} className="client-card">
            <div className="cc-thumb">
              {c.thumb ? <img src={c.thumb} alt="" loading="lazy" /> : <span className="cc-mono">{c.name.charAt(0).toUpperCase()}</span>}
            </div>
            <div className="cc-body">
              <div className="cc-row">
                <span className="cc-name">{c.name}</span>
                {c.open > 0 && <span className="open-badge" title={`${c.open} open comment${c.open === 1 ? '' : 's'}`}>{c.open}</span>}
              </div>
              <div className="cc-row">
                <span className="cc-dots">{c.dots.map((d, i) => <span key={i} className={`kb ${d.cls}`} title={d.title}>{d.letter}</span>)}</span>
                <span className="ago">{c.ago}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <dialog ref={dlg} className="dlg" onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
        <h2>Add client</h2>
        <form action={createClient}>
          <input className="input" name="name" placeholder="Client name" required autoFocus />
          <input className="input" name="email" type="email" placeholder="Contact email (optional)" />
          <input className="input" name="notes" placeholder="Notes (optional)" />
          <div className="head-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn-ghost" onClick={() => dlg.current?.close()}>Cancel</button>
            <SubmitButton className="btn btn-primary" pending="Adding…">Add client</SubmitButton>
          </div>
        </form>
      </dialog>
    </div>
  );
}
