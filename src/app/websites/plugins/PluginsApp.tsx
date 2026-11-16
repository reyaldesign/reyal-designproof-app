'use client';

import { Fragment, useMemo, useState } from 'react';
import { ago, hostOf } from '@/lib/websitesShared';
import WsTabs from '../WsTabs';

type Plugin = { name: string; version: string; active: boolean; update: string | null };
export type SiteRow = { id: string; name: string; url: string; status: string; readAt: string | null; plugins: Plugin[] };

const SORTS = { order: 'As listed', name: 'Name, A to Z', updates: 'Most updates first', plugins: 'Most plugins first' } as const;
type SortKey = keyof typeof SORTS;
const count = (r: SiteRow) => ({ all: r.plugins.length, inactive: r.plugins.filter((p) => !p.active).length, updates: r.plugins.filter((p) => p.update).length });

/** Every website with the plugins on it, as read from MainWP. Click a website to see its plugins. */
export default function PluginsApp({ rows }: { rows: SiteRow[] }) {
  const statuses = useMemo(() => [...new Set(rows.map((r) => r.status))].sort(), [rows]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(() => (statuses.includes('Live') ? 'Live' : '')); // opens on the Live websites, like the Sites tab
  const [updates, setUpdates] = useState(false);
  const [sort, setSort] = useState<SortKey>('order');
  const [open, setOpen] = useState<Set<string>>(new Set());

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
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; });

  return (
    <div className="page ws-page">
      <WsTabs />
      <div className="page-head">
        <div>
          <h1 className="h1">Plugins <span className="count">{shown.length}</span></h1>
          <p className="muted" style={{ marginTop: 8 }}>Every website with the plugins on it, read from MainWP{latest ? ` ${ago(latest)}` : ''}. Click a website to see its plugins. Use Sync plugins on the Sites tab to read again.</p>
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

      <div className="ws-pwrap">
        <table className="ws-pt">
          <thead><tr><th>Website</th><th>Plugins</th><th>Inactive</th><th>Updates</th></tr></thead>
          <tbody>
            {shown.map((r) => {
              const c = count(r);
              return (
                <Fragment key={r.id}>
                  <tr>
                    <td>
                      {r.readAt
                        ? <button className="ws-pname" onClick={() => toggle(r.id)} aria-expanded={open.has(r.id)}><span aria-hidden>{open.has(r.id) ? '▾' : '▸'}</span>{r.name}</button>
                        : <span className="ws-pname ws-pname-off"><span aria-hidden /> {r.name}</span>}
                      {r.url && <small className="ws-psub">{hostOf(r.url)}</small>}
                    </td>
                    {r.readAt ? (<>
                      <td className="ws-num">{c.all}</td>
                      <td className="ws-num">{c.inactive || '·'}</td>
                      <td>{c.updates ? <span className="ws-chip ws-c-wip">{c.updates} update{c.updates === 1 ? '' : 's'}</span> : <span className="ws-dash">·</span>}</td>
                    </>) : <td colSpan={3} className="muted">Not in MainWP, or not read yet</td>}
                  </tr>
                  {open.has(r.id) && (
                    <tr className="ws-prow"><td colSpan={4}>
                      {!r.plugins.length ? <p className="muted">No plugins.</p> : (
                        <table className="ws-mini">
                          <thead><tr><th>Plugin</th><th>Version</th><th>Status</th><th /></tr></thead>
                          <tbody>{[...r.plugins].sort((a, b) => Number(!!b.update) - Number(!!a.update) || Number(b.active) - Number(a.active)).map((p) => (
                            <tr key={p.name} className={p.active ? '' : 'ws-inactive'}>
                              <td>{p.name}</td>
                              <td>{p.version || '·'}</td>
                              <td>{p.active ? 'Active' : 'Inactive'}</td>
                              <td>{p.update ? <span className="ws-chip ws-c-wip">Update to {p.update}</span> : null}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      )}
                    </td></tr>
                  )}
                </Fragment>
              );
            })}
            {!shown.length && <tr><td colSpan={4} className="ws-empty">No websites match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
