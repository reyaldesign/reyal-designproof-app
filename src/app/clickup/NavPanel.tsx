'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { Nav, NavFolder, NavList, NavSpace } from '@/lib/clickupData';
import { disconnect } from './actions';
import { BOARD_LIST_ID, GROUP_PREFIXES, SPACE_ID, TEAM_FOLDERS, readableList, spaceTile, typeDot } from '@/lib/clickupView';

type Saved = { open: Record<string, boolean>; collapsed: boolean; recent: string[] };
type RowProps = { depth?: number; active?: boolean; href?: string; onClick?: () => void; chev?: string; icon?: React.ReactNode; label: string; sub?: string; n?: number; late?: boolean };

const groupOf = (name: string) => GROUP_PREFIXES.find((p) => name.startsWith(`${p} `));
const folderIcon = <span className="cu-ficon" />;

function Row({ depth = 0, active, href, onClick, chev = '', icon, label, sub, n, late }: RowProps) {
  const body = (
    <>
      <span className="cu-chev">{chev}</span>{icon}
      <span className="cu-rl"><b>{label}</b>{sub && <small>{sub}</small>}</span>
      {!!n && <span className={`cu-n ${late ? 'late' : ''}`}>{n}</span>}
    </>
  );
  const cls = `cu-nrow ${active ? 'on' : ''}`, style = { paddingLeft: 8 + depth * 14 };
  return href ? <Link href={href} className={cls} style={style}>{body}</Link> : <button type="button" className={cls} style={style} onClick={onClick}>{body}</button>;
}

/** The ClickUp panel: search, My tasks, the last three lists, then every space. What is expanded is remembered per person in this browser. */
export default function NavPanel({ nav, userId, userName }: { nav: Nav; userId: string; userName: string }) {
  const path = usePathname();
  const params = useSearchParams();
  const active = path === '/clickup' ? params.get('list') || BOARD_LIST_ID : null;
  const key = `rp:cu:${userId}`;
  const [st, setSt] = useState<Saved>({ open: { [SPACE_ID]: true }, collapsed: false, recent: [] });
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState('');
  const [now, setNow] = useState(0);

  const save = (next: Saved) => { setSt(next); try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage unavailable */ } };
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(key) ?? 'null') as Saved | null; if (s) setSt({ open: s.open ?? {}, collapsed: !!s.collapsed, recent: s.recent ?? [] }); } catch { /* start fresh */ }
    setReady(true); setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [key]);

  // Where every list lives, so opening one can expand its space, group and folder, and Recent can show it by name.
  const index = useMemo(() => {
    const m = new Map<string, { list: NavList; folder?: NavFolder; space: NavSpace }>();
    for (const s of nav.spaces) { s.loose.forEach((l) => m.set(l.id, { list: l, space: s })); s.folders.forEach((f) => f.lists.forEach((l) => m.set(l.id, { list: l, folder: f, space: s }))); }
    return m;
  }, [nav]);

  useEffect(() => {
    if (!ready || !active) return;
    const hit = index.get(active);
    if (!hit) return;
    const open = { ...st.open, [hit.space.id]: true, ...(hit.folder ? { [hit.folder.id]: true } : {}), ...(hit.folder && groupOf(hit.folder.name) ? { [`g:${groupOf(hit.folder.name)}`]: true } : {}) };
    const recent = [active, ...st.recent.filter((x) => x !== active)].slice(0, 3);
    if (recent.join() !== st.recent.join() || Object.keys(open).length !== Object.keys(st.open).length) save({ ...st, open, recent });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ready, index]);

  const toggle = (id: string) => () => save({ ...st, open: { ...st.open, [id]: !st.open[id] } });
  const go = (l: NavList) => `/clickup?list=${l.id}`;
  const synced = !ready ? 'Synced' : Math.round((now - nav.at) / 60_000) < 1 ? 'Synced just now' : `Synced ${Math.round((now - nav.at) / 60_000)} min ago`;

  const listRow = (l: NavList, depth: number, within?: string) => {
    const r = readableList(l.name);
    return <Row key={l.id} href={go(l)} depth={depth} active={l.id === active} icon={<span className="cu-dot" style={{ background: typeDot(r.type) }} />} label={within ? `${within} · ${r.label}` : r.label} sub={r.code} n={l.open} late={l.late} />;
  };
  const folderRows = (f: NavFolder, depth: number, short = f.name) => [
    <Row key={f.id} depth={depth} chev={st.open[f.id] ? '▾' : '▸'} icon={folderIcon} label={short} n={f.lists.reduce((a, l) => a + l.open, 0)} late={f.lists.some((l) => l.late)} onClick={toggle(f.id)} />,
    ...(st.open[f.id] ? f.lists.map((l) => listRow(l, depth + 1)) : []),
  ];

  const spaceRows = (sp: NavSpace) => {
    const rows: React.ReactNode[] = [
      <Row key={sp.id} chev={st.open[sp.id] ? '▾' : '▸'} icon={<span className="cu-tile" style={{ background: spaceTile(sp.name) }}>{sp.name[0]}</span>} label={sp.name} onClick={toggle(sp.id)} />,
    ];
    if (!st.open[sp.id]) return rows;
    sp.loose.forEach((l) => rows.push(listRow(l, 1)));
    if (sp.id !== SPACE_ID) { sp.folders.forEach((f) => rows.push(...folderRows(f, 1))); return rows; }

    // Fulfillment: team folders first, then clients A to Z, with the multi-location clients grouped.
    rows.push(<div key="teams" className="cu-head">Teams</div>);
    sp.folders.filter((f) => TEAM_FOLDERS.includes(f.name)).forEach((f) => rows.push(...folderRows(f, 1)));
    rows.push(<div key="clients" className="cu-head">Clients</div>);
    const singles: NavFolder[] = [], groups = new Map<string, NavFolder[]>();
    for (const f of sp.folders.filter((x) => !TEAM_FOLDERS.includes(x.name))) { const g = groupOf(f.name); if (g) groups.set(g, [...(groups.get(g) ?? []), f]); else singles.push(f); }
    const sortKey = (s: string) => (/^[A-Za-z0-9]/.test(s) ? s.toLowerCase() : `~${s}`); // folders like "Inactive Clients" go last
    const entries = [...singles.map((f) => ({ k: f.name, f, g: '', fs: [] as NavFolder[] })), ...[...groups].map(([g, fs]) => ({ k: g, f: null, g, fs }))].sort((a, b) => sortKey(a.k).localeCompare(sortKey(b.k)));
    for (const e of entries) {
      if (e.f) { rows.push(...folderRows(e.f, 1)); continue; }
      const id = `g:${e.g}`;
      rows.push(<Row key={id} depth={1} chev={st.open[id] ? '▾' : '▸'} icon={<span className="cu-ficon group" />} label={e.g} sub={`${e.fs.length} locations`} n={e.fs.reduce((a, f) => a + f.lists.reduce((b, l) => b + l.open, 0), 0)} late={e.fs.some((f) => f.lists.some((l) => l.late))} onClick={toggle(id)} />);
      if (st.open[id]) e.fs.forEach((f) => rows.push(...folderRows(f, 2, f.name.slice(e.g.length + 1))));
    }
    return rows;
  };

  if (st.collapsed) {
    return <button type="button" className="cu-strip" onClick={() => save({ ...st, collapsed: false })}><span>»</span><span className="cu-vert">ClickUp lists</span></button>;
  }

  const needle = q.trim().toLowerCase();
  const hits = needle ? [...index.values()].filter(({ list, folder, space }) => `${folder?.name ?? space.name} ${list.name} ${readableList(list.name).label}`.toLowerCase().includes(needle)) : [];

  return (
    <nav className="cu-nav" aria-label="ClickUp lists">
      <div className="cu-nh">
        <div className="cu-nt"><span>ClickUp</span><span className="cu-sync"><i />{synced}</span><button type="button" className="cu-collapse" aria-label="Collapse panel" onClick={() => save({ ...st, collapsed: true })}>«</button></div>
        <label className="cu-nsearch"><span aria-hidden="true" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a client or list" aria-label="Find a client or list" /></label>
      </div>
      <div className="cu-ntree">
        <Row href="/clickup/mine" active={path === '/clickup/mine'} icon={<span className="cu-me">{userName[0]}</span>} label="My tasks" n={nav.mine} late={false} />
        {needle ? (
          <>
            <div className="cu-head">{hits.length ? `${hits.length} lists` : 'No lists match'}</div>
            {hits.slice(0, 40).map(({ list, folder, space }) => listRow(list, 0, folder?.name ?? space.name))}
          </>
        ) : (
          <>
            {st.recent.some((id) => index.has(id)) && <div className="cu-head">Recent</div>}
            {st.recent.map((id) => index.get(id)).filter((x) => !!x).map((x) => listRow(x!.list, 0, x!.folder?.name ?? x!.space.name))}
            <div className="cu-head">Spaces</div>
            {nav.spaces.flatMap(spaceRows)}
          </>
        )}
      </div>
      <form action={disconnect} className="cu-disc"><button type="submit">Disconnect ClickUp</button></form>
    </nav>
  );
}
