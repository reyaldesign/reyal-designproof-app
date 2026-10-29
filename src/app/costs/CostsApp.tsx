'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import SubmitButton from '@/components/SubmitButton';
import { COST_CATEGORIES, daysTo, fmtDate, money, perMonth, termLabel, termMonths, type CostRow } from '@/lib/costsShared';
import { deleteCost, saveCost } from './actions';

const SORTS = {
  name: (r: CostRow) => r.name.toLowerCase(),
  category: (r: CostRow) => r.category,
  term: (r: CostRow) => termMonths(r),
  cost: (r: CostRow) => r.cost,
  month: (r: CostRow) => perMonth(r),
  renewal: (r: CostRow) => r.renewal || null,
} as const;
type SortKey = keyof typeof SORTS;
// Column heads: the key to sort by, and whether the column is a number.
const COLS: { key: SortKey; label: string; num?: boolean }[] = [
  { key: 'name', label: 'Item' }, { key: 'category', label: 'Category' }, { key: 'term', label: 'Billed every' },
  { key: 'cost', label: 'Cost', num: true }, { key: 'month', label: 'Per month', num: true }, { key: 'month', label: 'Per year', num: true }, { key: 'renewal', label: 'Renews' },
];

function Renewal({ d }: { d: string }) {
  const n = daysTo(d);
  if (n === null) return <span className="cs-pill cs-none">No date</span>;
  const cls = n < 0 ? 'cs-late' : n <= 30 ? 'cs-soon' : 'cs-ok';
  return <><div>{fmtDate(d)}</div><span className={`cs-pill ${cls}`}>{n < 0 ? `${-n}d overdue` : n === 0 ? 'Today' : `in ${n}d`}</span></>;
}

function CostForm({ row, onDone }: { row: CostRow | null; onDone: () => void }) {
  const [state, action] = useActionState(saveCost, null);
  const [del, setDel] = useState(false);
  const delForm = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) onDone(); }, [state, onDone]);
  const m = row ? termMonths(row) : 12;
  const [term, unit] = m % 12 ? [m, 'mo'] : [m / 12, 'yr'];
  return (
    <>
      <form action={action} className="cs-form">
        <input type="hidden" name="id" value={row?.id ?? ''} />
        <label className="cs-wide">Name<input className="input" name="name" required defaultValue={row?.name} placeholder="Elementor Pro" /></label>
        <label>Vendor<input className="input" name="vendor" defaultValue={row?.vendor} placeholder="Elementor" /></label>
        <label>Category<select className="input" name="category" defaultValue={row?.category ?? 'Plugin'}>{COST_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Cost per term (USD)<input className="input" name="cost" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={row?.cost ?? ''} placeholder="Leave blank if unknown" /></label>
        <label>Billed every
          <span className="cs-term"><input className="input" name="term" type="number" min="1" max="99" required defaultValue={term} aria-label="Term length" />
            <select className="input" name="termUnit" defaultValue={unit} aria-label="Term unit"><option value="yr">Years</option><option value="mo">Months</option></select></span>
        </label>
        <label>Next renewal<input className="input" name="renewal" type="date" defaultValue={row?.renewal} /></label>
        <label>Plan / seats<input className="input" name="plan" defaultValue={row?.plan} placeholder="Agency, 1000 sites" /></label>
        <label className="cs-wide">Notes<textarea className="input" name="notes" rows={2} defaultValue={row?.notes} placeholder="Which sites it covers, login owner, card on file" /></label>
        {state?.error && <p className="cs-err cs-wide" role="alert">{state.error}</p>}
        <div className="head-actions cs-wide" style={{ justifyContent: 'space-between' }}>
          {row ? <button type="button" className="btn-ghost" style={{ color: 'var(--bad)' }} onClick={() => setDel(true)}>Delete…</button> : <span />}
          <div className="head-actions">
            <button type="button" className="btn-ghost" onClick={onDone}>Cancel</button>
            <SubmitButton className="btn btn-primary" pending="Saving…">Save</SubmitButton>
          </div>
        </div>
      </form>
      {row && del && (
        <form ref={delForm} action={async (f) => { await deleteCost(f); onDone(); }} className="cs-del">
          <input type="hidden" name="id" value={row.id} />
          <span>Delete &ldquo;{row.name}&rdquo;? This cannot be undone.</span>
          <button type="button" className="btn-ghost" onClick={() => setDel(false)}>Keep it</button>
          <SubmitButton className="btn btn-danger" pending="Deleting…">Delete</SubmitButton>
        </form>
      )}
    </>
  );
}

export default function CostsApp({ rows }: { rows: CostRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'renewal', dir: 1 });
  const [editing, setEditing] = useState<CostRow | 'new' | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = dlg.current; if (!d) return; if (editing && !d.open) d.showModal(); if (!editing && d.open) d.close(); }, [editing]);

  const val = SORTS[sort.key];
  const sorted = [...rows].sort((a, b) => {
    const x = val(a), y = val(b);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1; // blanks always last
    return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || a.name.localeCompare(b.name);
  });
  const pick = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : 1 }));
  const month = rows.reduce((s, r) => s + (perMonth(r) ?? 0), 0);
  const next = rows.filter((r) => r.renewal && (daysTo(r.renewal) ?? -1) >= 0).sort((a, b) => a.renewal.localeCompare(b.renewal))[0];

  return (
    <div className="page cs-page">
      <div className="page-head">
        <div>
          <h1 className="h1">Stack costs <span className="count">{rows.length}</span></h1>
          <p className="muted" style={{ marginTop: 8 }}>Software, plugins, hosting and domains Reyal Design pays for.</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary" onClick={() => setEditing('new')}>Add item</button>
        </div>
      </div>

      <section className="cs-sum" aria-label="Totals">
        <div className="card"><span>Per month</span><b>{money(month)}</b><small>every plan spread over its term</small></div>
        <div className="card"><span>Per year</span><b>{money(month * 12)}</b><small>{rows.length} item{rows.length === 1 ? '' : 's'}</small></div>
        <div className="card"><span>Next renewal</span><b className="cs-next">{next ? next.name : 'None set'}</b><small>{next ? `${fmtDate(next.renewal)} · in ${daysTo(next.renewal)} days` : ' '}</small></div>
      </section>

      <div className="card cs-tablebox">
        <table className="cs-table">
          <thead><tr>
            {COLS.map((c) => (
              <th key={c.label} className={c.num ? 'cs-num' : ''} aria-sort={sort.key === c.key ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}>
                <button type="button" className="cs-th" onClick={() => pick(c.key)}>{c.label}<i aria-hidden="true" /></button>
              </th>
            ))}
            <th />
          </tr></thead>
          <tbody>
            {sorted.length ? sorted.map((r) => {
              const m = perMonth(r);
              return (
                <tr key={r.id}>
                  <td><div className="cs-name">{r.name}</div><div className="cs-meta">{[r.vendor, r.plan].filter(Boolean).join(' · ')}</div>{r.notes && <div className="cs-meta">{r.notes}</div>}</td>
                  <td>{r.category}</td>
                  <td>{termLabel(r)}</td>
                  <td className="cs-num">{r.cost == null ? <span className="cs-missing">Add price</span> : money(r.cost)}</td>
                  <td className="cs-num">{m == null ? '–' : money(m)}</td>
                  <td className="cs-num">{m == null ? '–' : money(m * 12)}</td>
                  <td><Renewal d={r.renewal} /></td>
                  <td><button className="btn-ghost" onClick={() => setEditing(r)}>Edit</button></td>
                </tr>
              );
            }) : <tr><td colSpan={8} className="cs-empty">Nothing tracked yet. Use &ldquo;Add item&rdquo; to log your first tool.</td></tr>}
          </tbody>
        </table>
      </div>

      <dialog ref={dlg} className="dlg cs-dlg" onClose={() => setEditing(null)} onClick={(e) => { if (e.target === dlg.current) setEditing(null); }}>
        <h2>{editing === 'new' ? 'Add item' : 'Edit item'}</h2>
        {editing && <CostForm key={editing === 'new' ? 'new' : editing.id} row={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      </dialog>
    </div>
  );
}
