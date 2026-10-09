'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import SubmitButton from '@/components/SubmitButton';
import { STATUS, STATUS_ORDER } from '@/lib/status';
import { PROOF_TYPES } from '@/lib/types';
import { createClient } from './actions';

export type ClientCard = {
  id: string; name: string; thumb: string | null; open: number; counts: Record<string, number>; total: number;
  lastMs: number; ago: string; latestTitle: string | null; types: string[]; titles: string[];
};
export type AttentionItem = { proofId: string; title: string; client: string; version: number; ago: string; open: number; thumb: string | null };

type Sort = 'attention' | 'recent' | 'az';
const SORTS: [Sort, string][] = [['attention', 'Needs attention'], ['recent', 'Recent'], ['az', 'A–Z']];

export default function ClientGrid({ clients, attention, totalOpen, error, aiTool = false }: { clients: ClientCard[]; attention: AttentionItem[]; totalOpen: number; error?: string; aiTool?: boolean }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('attention');
  const [type, setType] = useState<string>('all');
  const dlg = useRef<HTMLDialogElement>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = clients.filter((c) => (type === 'all' || c.types.includes(type)) && (!needle || c.name.toLowerCase().includes(needle) || c.titles.some((t) => t.toLowerCase().includes(needle))));
    return [...list].sort(sort === 'az' ? (a, b) => a.name.localeCompare(b.name) : sort === 'recent' ? (a, b) => b.lastMs - a.lastMs : (a, b) => b.open - a.open || b.lastMs - a.lastMs);
  }, [clients, q, sort, type]);

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="h1">Clients <span className="count">{clients.length}</span></h1>
        <div className="head-actions">
          <label className="search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" placeholder="Search clients and proofs" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search clients and proofs" />
          </label>
          <button className="btn btn-primary" onClick={() => dlg.current?.showModal()}>+ Add client</button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm" style={{ color: 'var(--bad)' }}>{error}</p>}

      {aiTool && (
        <Link href="/aireviewer" className="tool-tile">
          <span className="tool-ic" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.5l-1.9-5.7L4.5 11l5.6-1.9z" /><path d="M19 3.5v3M17.5 5h3" /></svg>
          </span>
          <span className="tool-text"><b>AI Reviewer</b><span>Check images against your checklist before they go to proofing</span></span>
          <span className="tool-go">Open →</span>
        </Link>
      )}

      {attention.length > 0 && (
        <section className="wait" aria-label="Waiting on you">
          <div className="wait-head">
            <span className="wait-title">Waiting on you</span>
            <span className="muted">{totalOpen} open request{totalOpen === 1 ? '' : 's'} on {attention.length} proof{attention.length === 1 ? '' : 's'}</span>
            <Link href="/admin/requests" className="wait-all">All requests →</Link>
          </div>
          <div className="wait-grid">
            {attention.slice(0, 3).map((p) => (
              <Link key={p.proofId} href={`/admin/${p.proofId}`} className="wait-item">
                <span className="wait-thumb">{p.thumb && <img src={p.thumb} alt="" loading="lazy" />}</span>
                <span className="wait-text"><b>{p.title}</b><span>{p.client} · v{p.version} · {p.ago}</span></span>
                <span className="wait-n">{p.open}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="filters">
        <div className="segbar" role="tablist" aria-label="Sort clients">
          {SORTS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={sort === k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>{label}</button>
          ))}
        </div>
        <div className="tchips" aria-label="Filter by type">
          <button className={`tchip ${type === 'all' ? 'on' : ''}`} onClick={() => setType('all')}><i className="kb all">•</i>All types</button>
          {PROOF_TYPES.map((t) => (
            <button key={t.value} className={`tchip ${type === t.value ? 'on' : ''}`} onClick={() => setType(t.value)}><i className={`kb kt-${t.value}`}>{t.letter}</i>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="client-grid">
        {!clients.length && <div className="empty-state"><h2>No clients yet</h2><p>Add your first client to start sharing proofs.</p></div>}
        {clients.length > 0 && !shown.length && <div className="empty-state"><p>No clients match your search and filters.</p></div>}
        {shown.map((c) => (
          <Link key={c.id} href={`/admin/clients/${c.id}`} className="client-card slim">
            <div className="cc-thumb">
              {c.thumb ? <img src={c.thumb} alt="" loading="lazy" /> : <span className="cc-mono">{c.name.charAt(0).toUpperCase()}</span>}
            </div>
            <div className="cc-body">
              <div className="cc-row">
                <span className="cc-name">{c.name}</span>
                {c.open > 0 && <span className="chip chip-needs" title="Open client comments">{c.open} open</span>}
              </div>
              <div className="sumdots">
                {c.total === 0 && <span className="muted">No proofs yet</span>}
                {STATUS_ORDER.filter((s) => c.counts[s]).map((s) => (
                  <span key={s}><i style={{ background: STATUS[s].color }} />{c.counts[s]} {STATUS[s].short}</span>
                ))}
              </div>
              <div className="ago-line">Active {c.ago}{c.latestTitle ? ` · ${c.latestTitle}` : ''}</div>
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
