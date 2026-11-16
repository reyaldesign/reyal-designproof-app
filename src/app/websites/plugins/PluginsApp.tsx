'use client';

import { Fragment, useMemo, useState } from 'react';
import { ago } from '@/lib/websitesShared';
import WsTabs from '../WsTabs';

export type Install = { slug: string; name: string; version: string; active: boolean; update: string | null; siteId: string; site: string; siteStatus: string };
type Group = { slug: string; name: string; installs: Install[]; active: number; inactive: number; updates: number; versions: string[] };

const SORTS = { name: 'Name, A to Z', sites: 'Most websites first', updates: 'Most updates first' } as const;
type SortKey = keyof typeof SORTS;

/** One row per plugin, listing the websites that have it, the way MainWP's own Plugins page does. */
export default function PluginsApp({ installs, readAt }: { installs: Install[]; readAt: string | null }) {
  const statuses = useMemo(() => [...new Set(installs.map((i) => i.siteStatus))].sort(), [installs]);
  const sites = useMemo(() => [...new Map(installs.map((i) => [i.siteId, i.site])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [installs]);
  const [q, setQ] = useState('');
  const [state, setState] = useState<'' | 'active' | 'inactive'>('');
  const [updates, setUpdates] = useState(false);
  const [site, setSite] = useState('');
  const [siteStatus, setSiteStatus] = useState(() => (statuses.includes('Live') ? 'Live' : '')); // opens on the Live websites, like the Sites tab
  const [sort, setSort] = useState<SortKey>('name');
  const [open, setOpen] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const by = new Map<string, Group>();
    for (const i of installs) {
      if ((siteStatus && i.siteStatus !== siteStatus) || (site && i.siteId !== site)) continue;
      if ((state === 'active' && !i.active) || (state === 'inactive' && i.active) || (updates && !i.update)) continue;
      if (needle && !i.name.toLowerCase().includes(needle)) continue;
      const g = by.get(i.slug) ?? { slug: i.slug, name: i.name, installs: [], active: 0, inactive: 0, updates: 0, versions: [] };
      g.installs.push(i);
      if (i.active) g.active++; else g.inactive++;
      if (i.update) g.updates++;
      if (i.version && !g.versions.includes(i.version)) g.versions.push(i.version);
      by.set(i.slug, g);
    }
    const list = [...by.values()];
    for (const g of list) { g.installs.sort((a, b) => a.site.localeCompare(b.site)); g.versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true })); }
    return list.sort((a, b) => (sort === 'sites' ? b.installs.length - a.installs.length : sort === 'updates' ? b.updates - a.updates : 0) || a.name.localeCompare(b.name));
  }, [installs, q, state, updates, site, siteStatus, sort]);

  const total = groups.reduce((n, g) => n + g.installs.length, 0);
  const waiting = groups.reduce((n, g) => n + g.updates, 0);
  const inactive = groups.reduce((n, g) => n + g.inactive, 0);
  const toggle = (slug: string) => setOpen((s) => { const n = new Set(s); if (!n.delete(slug)) n.add(slug); return n; });

  return (
    <div className="page ws-page">
      <WsTabs />
      <div className="page-head">
        <div>
          <h1 className="h1">Plugins <span className="count">{groups.length}</span></h1>
          <p className="muted" style={{ marginTop: 8 }}>Every plugin on the websites in MainWP{readAt ? `, read ${ago(readAt)}` : ''}. Click a plugin to see which websites have it. Use Sync plugins on the Sites tab to read again.</p>
        </div>
      </div>

      <div className="ws-sum">
        <div className="card"><b>{groups.length}</b><span>Plugins</span></div>
        <div className="card"><b>{total}</b><span>Installs on websites</span></div>
        <div className="card"><b className={waiting ? 'ws-warn' : ''}>{waiting}</b><span>Updates waiting</span></div>
        <div className="card"><b>{inactive}</b><span>Inactive installs</span></div>
      </div>

      <div className="ws-filters">
        <input className="input" type="search" placeholder="Search plugins" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search plugins" />
        <select className="input" value={state} onChange={(e) => setState(e.target.value as typeof state)} aria-label="Plugin status">
          <option value="">Active and inactive</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <select className="input" value={updates ? 'updates' : ''} onChange={(e) => setUpdates(e.target.value === 'updates')} aria-label="Updates">
          <option value="">All versions</option>
          <option value="updates">Update available</option>
        </select>
        <select className="input" value={site} onChange={(e) => setSite(e.target.value)} aria-label="Website">
          <option value="">All websites</option>
          {sites.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select className="input" value={siteStatus} onChange={(e) => setSiteStatus(e.target.value)} aria-label="Website status">
          <option value="">All website statuses</option>
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort by">
          {(Object.keys(SORTS) as SortKey[]).map((k) => <option key={k} value={k}>Sort: {SORTS[k]}</option>)}
        </select>
      </div>

      {!installs.length ? (
        <div className="empty-state"><h2>No plugins read yet</h2><p>Click Sync plugins on the Sites tab to read them from MainWP.</p></div>
      ) : (
        <div className="ws-pwrap">
          <table className="ws-pt">
            <thead><tr><th>Plugin</th><th>Websites</th><th>Active</th><th>Inactive</th><th>Updates</th><th>Versions</th></tr></thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.slug}>
                  <tr>
                    <td><button className="ws-pname" onClick={() => toggle(g.slug)} aria-expanded={open.has(g.slug)}><span aria-hidden>{open.has(g.slug) ? '▾' : '▸'}</span>{g.name}</button></td>
                    <td className="ws-num">{g.installs.length}</td>
                    <td className="ws-num">{g.active || '·'}</td>
                    <td className="ws-num">{g.inactive || '·'}</td>
                    <td>{g.updates ? <span className="ws-chip ws-c-wip">{g.updates} update{g.updates === 1 ? '' : 's'}</span> : <span className="ws-dash">·</span>}</td>
                    <td>{g.versions.slice(0, 3).join(', ') || '·'}{g.versions.length > 3 && <span className="muted"> +{g.versions.length - 3}</span>}</td>
                  </tr>
                  {open.has(g.slug) && (
                    <tr className="ws-prow"><td colSpan={6}>
                      <table className="ws-mini">
                        <thead><tr><th>Website</th><th>Version</th><th>Status</th><th /></tr></thead>
                        <tbody>{g.installs.map((i) => (
                          <tr key={i.siteId} className={i.active ? '' : 'ws-inactive'}>
                            <td>{i.site}</td>
                            <td>{i.version || '·'}</td>
                            <td>{i.active ? 'Active' : 'Inactive'}</td>
                            <td>{i.update ? <span className="ws-chip ws-c-wip">Update to {i.update}</span> : null}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </td></tr>
                  )}
                </Fragment>
              ))}
              {!groups.length && <tr><td colSpan={6} className="ws-empty">No plugins match.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
