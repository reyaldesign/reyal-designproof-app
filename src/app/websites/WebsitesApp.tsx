'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import SubmitButton from '@/components/SubmitButton';
import { CHECK_EVERY_MIN, FIELDS, STATE_LABEL, ago, hostOf, upClass, type FieldKey } from '@/lib/websitesShared';
import { checkAll, importCsv, saveWebsite } from './actions';

export type Row = Record<FieldKey, string> & {
  id: string;
  state: 'up' | 'down' | 'none' | 'off'; // up and down come from the latest check; none is not checked yet; off is not monitored
  ms: number | null; error: string | null; lastAt: string | null;
  up1: number | null; up7: number | null; up30: number | null;
  strip: (number | null)[]; // uptime % for each of the last 30 days, oldest first; null when nothing was checked that day
};

const STATE_RANK = { down: 0, up: 1, none: 2, off: 3 } as const;
const SORTS = {
  order: 'As listed',
  name: 'Name, A to Z',
  state: 'Down first',
  up30: 'Lowest uptime first',
} as const;
type SortKey = keyof typeof SORTS;
const compare = (key: SortKey) => (a: Row, b: Row) => {
  if (key === 'name') return a.clientName.localeCompare(b.clientName, undefined, { numeric: true });
  if (key === 'state') return STATE_RANK[a.state] - STATE_RANK[b.state] || a.clientName.localeCompare(b.clientName);
  const x = a.state === 'off' ? null : a.up30, y = b.state === 'off' ? null : b.up30; // sites with no figure go last
  return x == null || y == null ? (x == null ? 1 : 0) - (y == null ? 1 : 0) : x - y;
};

/** The letters shown in a site's icon, and a steady colour picked from its name. */
const initials = (name: string) => name.split(/[\s.]+/).filter((w) => /^[a-z0-9]/i.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
const hue = (name: string) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

const statusChip = (s: string) => {
  const k = s.toLowerCase();
  return k === 'live' ? 'ws-c-live' : k === 'in progress' || k === 'for transfer' ? 'ws-c-wip' : k === 'forward only' ? 'ws-c-fwd' : 'ws-c-off';
};

function Cell({ field, v }: { field: FieldKey; v: string }) {
  if (!v) return <span className="ws-dash">·</span>;
  if (field === 'status') return <span className={`ws-chip ${statusChip(v)}`}>{v}</span>;
  if (field === 'formSubmission' && v.toLowerCase() === 'to check') return <span className="ws-chip ws-c-wip">{v}</span>;
  if (v === 'N/A') return <span className="ws-dash">N/A</span>;
  return <>{v}</>;
}

function SiteForm({ row, options, onDone }: { row: Row | null; options: Record<string, string[]>; onDone: () => void }) {
  const [state, action] = useActionState(saveWebsite, null);
  useEffect(() => { if (state?.ok) onDone(); }, [state, onDone]);
  return (
    <form action={action} className="ws-form">
      {row && <input type="hidden" name="id" value={row.id} />}
      {FIELDS.map((f) => (
        <label key={f.key} className={f.key === 'clientName' || f.key === 'url' ? 'ws-wide' : ''}>
          <span>{f.label}</span>
          <input className="input" name={f.key} defaultValue={state?.values?.[f.key] ?? row?.[f.key] ?? (f.key === 'status' ? 'Live' : '')} list={'list' in f ? `ws-${f.key}` : undefined}
            placeholder={f.key === 'url' ? 'https://example.com' : ''} required={f.key === 'clientName'} autoComplete="off" />
          {'list' in f && <datalist id={`ws-${f.key}`}>{options[f.key]?.map((o) => <option key={o} value={o} />)}</datalist>}
        </label>
      ))}
      <p className="muted ws-wide" style={{ fontSize: 12 }}>Only sites with the status Live are checked for uptime, every {CHECK_EVERY_MIN} minutes.</p>
      {state?.error && <p className="ws-err ws-wide" role="alert">{state.error}</p>}
      <div className="head-actions ws-wide" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn-ghost" onClick={onDone}>Cancel</button>
        <SubmitButton className="btn btn-primary" pending="Saving…">{row ? 'Save changes' : 'Add website'}</SubmitButton>
      </div>
    </form>
  );
}

function ImportForm({ onDone }: { onDone: () => void }) {
  const [state, action] = useActionState(importCsv, null);
  return (
    <form action={action} className="ws-form" style={{ gridTemplateColumns: '1fr' }}>
      <p className="muted" style={{ fontSize: 13 }}>Choose a CSV file whose first row is the column names (Client Name, Website Link, Status, and so on). Websites already in the list are skipped, so it is safe to import the same sheet again. In Google Sheets, use File, Download, Comma Separated Values.</p>
      <input className="input" type="file" name="file" accept=".csv,text/csv" required />
      {state?.error && <p className="ws-err" role="alert">{state.error}</p>}
      {state?.ok && <p className="ws-ok" role="status">{state.ok}</p>}
      <div className="head-actions" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn-ghost" onClick={onDone}>{state?.ok ? 'Close' : 'Cancel'}</button>
        <SubmitButton className="btn btn-primary" pending="Importing…">Import</SubmitButton>
      </div>
    </form>
  );
}

const DETAILS: FieldKey[] = ['captcha', 'backup', 'desktopStatus', 'mobileStatus', 'seo', 'formSubmission', 'emailUsed'];

export default function WebsitesApp({ rows, days, options, editId }: { rows: Row[]; days: string[]; options: Record<string, string[]>; editId?: string }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [server, setServer] = useState('');
  const [sort, setSort] = useState<SortKey>('order');
  const [editing, setEditing] = useState<Row | 'new' | null>(() => rows.find((r) => r.id === editId) ?? null);
  const [importing, setImporting] = useState(false);
  const [checking, setChecking] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);
  const imp = useRef<HTMLDialogElement>(null);

  useEffect(() => { const d = dlg.current; if (!d) return; if (editing && !d.open) d.showModal(); if (!editing && d.open) d.close(); }, [editing]);
  useEffect(() => { const d = imp.current; if (!d) return; if (importing && !d.open) d.showModal(); if (!importing && d.open) { d.close(); router.refresh(); } }, [importing, router]);

  // The page keeps itself current: the numbers are re-read every minute.
  useEffect(() => { const t = setInterval(() => router.refresh(), 60_000); return () => clearInterval(t); }, [router]);

  const shown = useMemo(() => {
    const list = rows.filter((r) =>
      (!status || r.status === status) && (!server || r.server === server) &&
      (!q.trim() || `${r.clientName} ${r.url}`.toLowerCase().includes(q.trim().toLowerCase())));
    return sort === 'order' ? list : [...list].sort(compare(sort));
  }, [rows, q, status, server, sort]);

  const watched = rows.filter((r) => r.state !== 'off');
  const sum = { up: watched.filter((r) => r.state === 'up').length, down: watched.filter((r) => r.state === 'down').length };
  const avg = (() => { const v = watched.map((r) => r.up30).filter((x): x is number => x != null); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null; })();

  async function runAll() {
    setChecking(true);
    await checkAll();
    setTimeout(() => router.refresh(), 12_000);
    setTimeout(() => { router.refresh(); setChecking(false); }, 30_000);
  }

  return (
    <div className="page ws-page">
      <div className="page-head">
        <div>
          <h1 className="h1">Websites <span className="count">{rows.length}</span></h1>
          <p className="muted" style={{ marginTop: 8 }}>The sites we look after. Sites with the status Live are checked every {CHECK_EVERY_MIN} minutes.</p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => setImporting(true)}>Import CSV</button>
          <button className="btn" onClick={runAll} disabled={checking}>{checking ? 'Checking…' : 'Check all now'}</button>
          <button className="btn btn-primary" onClick={() => setEditing('new')}>+ Add website</button>
        </div>
      </div>

      <div className="ws-sum">
        <div className="card"><b>{watched.length}</b><span>Monitored</span></div>
        <div className="card"><b className="ws-good">{sum.up}</b><span>Up now</span></div>
        <div className="card"><b className={sum.down ? 'ws-bad' : ''}>{sum.down}</b><span>Down now</span></div>
        <div className="card"><b className={upClass(avg)}>{avg == null ? 'No data yet' : `${avg}%`}</b><span>Uptime, last 30 days</span></div>
      </div>

      <div className="ws-filters">
        <input className="input" type="search" placeholder="Search by name or link" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search websites" />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {options.status?.map((o) => <option key={o}>{o}</option>)}
        </select>
        <select className="input" value={server} onChange={(e) => setServer(e.target.value)} aria-label="Server used">
          <option value="">All servers</option>
          {options.server?.map((o) => <option key={o}>{o}</option>)}
        </select>
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort by">
          {(Object.keys(SORTS) as SortKey[]).map((k) => <option key={k} value={k}>Sort: {SORTS[k]}</option>)}
        </select>
      </div>

      {!rows.length ? (
        <div className="empty-state"><h2>No websites yet</h2><p>Add one, or import your sheet as a CSV file.</p></div>
      ) : (
        <div className="ws-cards">
          {shown.map((r) => (
            <article key={r.id} className={`card ws-card ws-k-${r.state}`}>
              <header>
                <span className="ws-icon" style={{ '--h': hue(r.clientName) } as React.CSSProperties} aria-hidden="true">
                  {initials(r.clientName)}
                  <span className={`ws-state ws-s-${r.state}`} title={STATE_LABEL[r.state]}><i /></span>
                </span>
                <Link href={`/websites/${r.id}`} className="ws-name">{r.clientName}</Link>
                <button className="btn-ghost ws-edit" onClick={() => setEditing(r)}>Edit</button>
              </header>
              {r.url ? <a className="ws-host" href={r.url} target="_blank" rel="noreferrer">{hostOf(r.url)} ↗</a> : <span className="ws-host ws-dash">No link</span>}
              {r.state === 'off' ? <div className="ws-bars ws-bars-off" aria-hidden="true">{r.strip.map((_, i) => <i key={i} />)}</div> : (
                <div className="ws-bars" role="img" aria-label="Uptime for each of the last 30 days">
                  {r.strip.map((p, i) => <i key={i} className={upClass(p)} title={`${days[i]}: ${p == null ? 'no checks' : `${p}%`}`} />)}
                </div>
              )}
              <div className="ws-line">
                <span className={`ws-s-${r.state}`} title={r.error ?? (r.lastAt ? `Last check ${ago(r.lastAt)}` : '')}>
                  {r.state === 'up' ? `Up${r.ms != null ? ` · ${r.ms} ms` : ''}` : r.state === 'down' ? `Down${r.error ? ` · ${r.error}` : ''}` : STATE_LABEL[r.state]}
                </span>
                {r.state !== 'off' && <span className={`ws-num ${upClass(r.up30)}`}>{r.up30 == null ? '·' : `${r.up30}%`}<small> 30 d</small></span>}
              </div>
              <div className="ws-tags">
                <Cell field="status" v={r.status} />
                {r.server && r.server !== 'N/A' && <span className="ws-tag">{r.server}</span>}
              </div>
              <details>
                <summary>Details</summary>
                <dl>
                  {FIELDS.filter((f) => DETAILS.includes(f.key)).map((f) => <div key={f.key}><dt>{f.label}</dt><dd><Cell field={f.key} v={r[f.key]} /></dd></div>)}
                </dl>
              </details>
            </article>
          ))}
          {!shown.length && <p className="ws-empty">No websites match.</p>}
        </div>
      )}

      <dialog ref={dlg} className="dlg ws-dlg" onClose={() => setEditing(null)} onClick={(e) => { if (e.target === dlg.current) setEditing(null); }}>
        <h2>{editing && editing !== 'new' ? 'Edit website' : 'Add website'}</h2>
        {editing && <SiteForm key={editing === 'new' ? 'new' : editing.id} row={editing === 'new' ? null : editing} options={options} onDone={() => { setEditing(null); router.refresh(); setTimeout(() => router.refresh(), 6000); }} />}
      </dialog>
      <dialog ref={imp} className="dlg ws-dlg" onClose={() => setImporting(false)} onClick={(e) => { if (e.target === imp.current) setImporting(false); }}>
        <h2>Import from a CSV file</h2>
        {importing && <ImportForm onDone={() => setImporting(false)} />}
      </dialog>
    </div>
  );
}
