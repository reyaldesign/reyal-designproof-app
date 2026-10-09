import Link from 'next/link';
import { requireTool } from '@/lib/access';
import type { CuTask } from '@/lib/clickup';
import { spaceTasks } from '@/lib/clickupData';
import { SPACE_NAME, between, clientOf, colorFor, dayKey, fmtDay, initialsOf, isDone, mondayOf, progressOf, rangeMs, shift, todayKey } from '@/lib/clickupView';
import TaskPanel from '../TaskPanel';
import { Failed, gate, url } from '../ui';

type Q = { from?: string; client?: string; task?: string; error?: string };
const WEEKS = 2;

export default async function Calendar({ searchParams }: { searchParams: Promise<Q> }) {
  const me = await requireTool('CLICKUP');
  const q = await searchParams;
  const blocked = await gate(me.id, q.error);
  if (blocked) return blocked;

  const today = todayKey();
  const start = mondayOf(/^\d{4}-\d{2}-\d{2}$/.test(q.from ?? '') ? q.from! : today);
  const end = shift(start, WEEKS * 7 - 1);
  const base = { from: q.from, client: q.client };
  const here = url('/clickup/calendar', { ...base, task: q.task });
  const close = url('/clickup/calendar', base);

  try {
    // Everything open drives the client list and counts. The dated range, which also shows finished work, drives the grid.
    const [open, ranged] = await Promise.all([
      spaceTasks(me.id, { cap: 500 }),
      spaceTasks(me.id, { closed: true, from: rangeMs(start) - 864e5, to: rangeMs(end) + 2 * 864e5, cap: 300 }),
    ]);
    const clients = new Map<string, number>();
    for (const t of open) clients.set(clientOf(t), (clients.get(clientOf(t)) ?? 0) + 1);
    const names = [...clients.keys()].sort((a, b) => a.localeCompare(b));
    const pick = (t: CuTask) => !q.client || clientOf(t) === q.client;
    const overdue = open.filter((t) => t.due_date && dayKey(Number(t.due_date)) < today).length;
    const byDay = new Map<string, typeof ranged>();
    for (const t of ranged.filter(pick)) {
      if (!t.due_date) continue;
      const k = dayKey(Number(t.due_date));
      byDay.set(k, [...(byDay.get(k) ?? []), t]);
    }
    const undated = open.filter((t) => !t.due_date && pick(t));
    const keys = Array.from({ length: WEEKS * 7 }, (_, i) => shift(start, i));
    const sameMonth = fmtDay(start, { month: 'short' }) === fmtDay(end, { month: 'short' });

    return (
      <div className="cu-cal">
        <aside className="cu-clients">
          <h2>Clients</h2>
          <Link href={url('/clickup/calendar', { from: q.from })} className={!q.client ? 'on' : ''}><span>★</span>All clients<em>{open.length}</em></Link>
          {names.map((n) => (
            <Link key={n} href={url('/clickup/calendar', { from: q.from, client: n })} className={q.client === n ? 'on' : ''}>
              <span className="cu-sq" style={{ background: colorFor(n) }}>{initialsOf(n)[0]}</span><b>{n}</b><em>{clients.get(n)}</em>
            </Link>
          ))}
        </aside>

        <div className="cu-pad">
          <div className="cu-top">
            <div>
              <p className="muted">{open.length} open · {overdue} overdue · {SPACE_NAME} space</p>
              <h1 className="cu-title">{q.client ?? 'All clients'}</h1>
            </div>
            <div className="cu-tools">
              <div className="cu-range">
                <Link href={url('/clickup/calendar', { ...base, from: shift(start, -7 * WEEKS), task: undefined })} aria-label="Earlier">‹</Link>
                <span>{fmtDay(start, { month: 'short', day: 'numeric' })} – {fmtDay(end, sameMonth ? { day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <Link href={url('/clickup/calendar', { ...base, from: shift(start, 7 * WEEKS), task: undefined })} aria-label="Later">›</Link>
              </div>
              <Link href={url('/clickup', { new: '1', due: today })} className="cu-red">+ Task</Link>
              <Link href="/clickup" className="cu-ghost">← Board</Link>
            </div>
          </div>
          {q.error && <div className="cu-error" role="alert">{q.error.slice(0, 200)}</div>}

          <div className="cu-dow">{['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) => <span key={d}>{d}</span>)}</div>
          <div className="cu-grid">
            {keys.map((k) => (
              <div key={k} className={`cu-day ${k === today ? 'today' : ''} ${k < today ? 'past' : ''}`}>
                <span className="cu-dn">{k === today ? <><i>{Number(k.slice(8))}</i> Today</> : Number(k.slice(8))}{k.slice(8) === '01' || k === start ? <small> {fmtDay(k, { month: 'short' })}</small> : null}</span>
                {(byDay.get(k) ?? []).map((t) => (
                  <Link key={t.id} href={url('/clickup/calendar', { ...base, task: t.id })} className={`cu-chip ${isDone(t) ? 'done' : ''} ${t.id === q.task ? 'on' : ''}`} title={`${clientOf(t)}: ${t.name}`}>
                    <i style={{ background: progressOf(t).color }} />{t.name}
                  </Link>
                ))}
              </div>
            ))}
          </div>
          {!!undated.length && (
            <div className="cu-undated"><span>No due date · {undated.length}</span>
              {undated.slice(0, 24).map((t) => <Link key={t.id} href={url('/clickup/calendar', { ...base, task: t.id })} className="cu-chip"><i style={{ background: progressOf(t).color }} />{t.name}</Link>)}
            </div>
          )}
          {open.length >= 500 && <p className="muted" style={{ marginTop: 12 }}>Counts cover the first 500 open tasks.</p>}
          {q.task && <TaskPanel userId={me.id} id={q.task} close={close} here={here} />}
        </div>
      </div>
    );
  } catch (e) {
    return <Failed e={e} />;
  }
}
