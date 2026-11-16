'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ago, hostOf, hue, initials } from '@/lib/websitesShared';
import PluginList, { type PluginRow } from '../PluginList';
import WsTabs from '../WsTabs';

export type SiteRow = { id: string; name: string; url: string; status: string; readAt: string | null; plugins: PluginRow[] };

const SORTS = { order: 'As listed', name: 'Name, A to Z', updates: 'Most updates first', plugins: 'Most plugins first' } as const;
type SortKey = keyof typeof SORTS;
const count = (r: SiteRow) => ({ all: r.plugins.length, inactive: r.plugins.filter((p) => !p.active).length, updates: r.plugins.filter((p) => p.update).length });

/** Every website as a card with its plugin count and updates waiting, as read from MainWP. Click a card for the plugin list. */
export default function PluginsApp({ rows }: { rows: SiteRow[] }) {
  const statuses = useMemo(() => [...new Set(rows.map((r) => r.status))].sort(), [rows]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [updates, setUpdates] = useState(false);
  const [sort, setSort] = useState<SortKey>('order');
  const [viewId, setViewId] = useState<string | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const viewing = rows.find((r) => r.id === viewId) ?? null;

  useEffect(() => { const d = dlg.current; if (!d) return; if (viewId && !d.open) d.showModal(); if (!viewId && d.open) d.close(); }, [viewId]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = rows.filter((r) =>
      (!status || r.status === status) && (!updates || r.plugins.some((p) => p.update)) &&
      (!needle || `${r.name} ${r.url}`.toLowerCase().includes(needle) || r.plugins.some((p) => p.name.toLowerCase().includes(needle))));
    if (sort === 'order') return list;
    return [...list].sort((a, b) => (sort === 'updates' ? count(b).updates - count(a).updates : sort === 'plugins' ? count(b).all - count(a).all : 0) || a.name.localeCompare(b.name));
  }, [rows, q, status, updates, sort]);

  const readSites = shown.filter((r) => r.readAt);
  const totals = readSites.reduce((t, r) => { const c = count(r); return { all: t.all + c.all, inactive: t.inactive + c.inactive, updates: t.updates + c.updates }; }, { all: 0, inactive: 0, updates: 0 });
  const latest = rows.reduce<string | null>((m, r) => (r.readAt && (!m || r.readAt > m) ? r.readAt : m), null);

  return (
    <div className="page ws-page">
      <WsTabs />
      <div className="page-head">
        <div>
          <h1 className="h1">Plugins <span className="count">{shown.length}</span></h1>
          <p className="muted" style={{ marginTop: 8 }}>Plugins on every website, read from MainWP{latest ? ` ${ago(latest)}` : ''}. Click a website to see its plugins. Use Sync plugins on the Sites tab to read again.</p>
        </div>
      </div>

      <div className="ws-sum">
        <div className="card"><b>{readSites.length}</b><span>Websites with a plugin list</span></div>
        <div className="card"><b>{totals.all}</b><span>Plugins installed</span></div>
        <div className="card"><b className={totals.updates ? 'ws-warn' : ''}>{totals.updates}</b><span>Updates waiting</span></div>
        <div className="card"><b>{totals.inactive}</b><span>Inactive plugins</span></div>
      </div>

      <div className="ws-filters">
        <input className="input" type="search" placeholder="Search by website or plugin" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search websites and plugins" />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Website status">
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="input" value={updates ? 'updates' : ''} onChange={(e) => setUpdates(e.target.value === 'updates')} aria-label="Updates">
          <option value="">All websites</option>
          <option value="updates">With updates waiting</option>
        </select>
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort by">
          {(Object.keys(SORTS) as SortKey[]).map((k) => <option key={k} value={k}>Sort: {SORTS[k]}</option>)}
        </select>
      </div>

      <div className="ws-cards">
        {shown.map((r) => {
          const c = count(r);
          return (
            <article key={r.id} className="card ws-card">
              <header>
                <span className="ws-icon" style={{ '--h': hue(r.name) } as React.CSSProperties} aria-hidden="true">{initials(r.name)}</span>
                <button className="ws-name" onClick={() => setViewId(r.id)}>{r.name}</button>
              </header>
              {r.url ? <a className="ws-host" href={r.url} target="_blank" rel="noreferrer">{hostOf(r.url)} ↗</a> : <span className="ws-host ws-dash">No link</span>}
              {r.readAt ? (
                <div className="ws-pstats">
                  <div><b>{c.all}</b><span>Plugins</span></div>
                  <div><b className={c.updates ? 'ws-warn' : ''}>{c.updates}</b><span>Updates</span></div>
                </div>
              ) : <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Not in MainWP, or not read yet</p>}
            </article>
          );
        })}
        {!shown.length && <p className="ws-empty">No websites match.</p>}
      </div>

      <dialog ref={dlg} className="dlg ws-dlg" onClose={() => setViewId(null)} onClick={(e) => { if (e.target === dlg.current) setViewId(null); }}>
        {viewing && (
          <div className="ws-view">
            <header className="ws-view-head">
              <span className="ws-icon" style={{ '--h': hue(viewing.name) } as React.CSSProperties} aria-hidden="true">{initials(viewing.name)}</span>
              <div>
                <h2 style={{ margin: 0 }}>{viewing.name}</h2>
                <p className="muted" style={{ margin: '4px 0 0' }}>{viewing.url ? hostOf(viewing.url) : 'No website link'}{viewing.readAt ? ` · read ${ago(viewing.readAt)}` : ''}</p>
              </div>
              <button className="btn-ghost ws-x" onClick={() => setViewId(null)} aria-label="Close">✕</button>
            </header>
            <div className="card"><PluginList plugins={viewing.plugins} /></div>
          </div>
        )}
      </dialog>
    </div>
  );
}
