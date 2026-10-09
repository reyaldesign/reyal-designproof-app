import { requireTool } from '@/lib/access';
import type { CuTask } from '@/lib/clickup';
import { myOpenTasks } from '@/lib/clickupData';
import { TEAM_ID, between, dayKey, isLate, isThisWeek, noteOf, readableList, todayKey } from '@/lib/clickupView';
import TaskPanel from '../TaskPanel';
import { Failed, TaskRow, gate, url } from '../ui';
import Link from 'next/link';

type Q = { f?: string; q?: string; task?: string; error?: string };

export default async function MyTasks({ searchParams }: { searchParams: Promise<Q> }) {
  const me = await requireTool('CLICKUP');
  const q = await searchParams;
  const blocked = await gate(me.id, q.error);
  if (blocked) return blocked;

  const base = { f: q.f, q: q.q };
  const here = url('/clickup/mine', { ...base, task: q.task });
  const close = url('/clickup/mine', base);

  try {
    const mine = await myOpenTasks(me.id);
    const FILTERS: [string, string, (t: CuTask) => boolean][] = [['all', 'All', () => true], ['late', 'Overdue', isLate], ['week', 'This week', isThisWeek]];
    const active = FILTERS.find(([k]) => k === q.f) ?? FILTERS[0];
    const needle = (q.q ?? '').toLowerCase();
    const shown = mine.filter((t) => active[2](t) && (!needle || `${t.name} ${noteOf(t)}`.toLowerCase().includes(needle)));

    const today = todayKey();
    const days = (t: CuTask) => (t.due_date ? between(today, dayKey(Number(t.due_date))) : null);
    const groups = [
      { name: 'Overdue', tone: 'late', items: shown.filter((t) => (days(t) ?? 0) < 0) },
      { name: 'Today', tone: 'today', items: shown.filter((t) => days(t) === 0) },
      { name: 'Next 7 days', tone: '', items: shown.filter((t) => (days(t) ?? -1) > 0 && days(t)! <= 7) },
      { name: 'Later', tone: 'later', items: shown.filter((t) => (days(t) ?? -1) > 7) },
      { name: 'No due date', tone: 'later', items: shown.filter((t) => days(t) === null) },
    ].filter((g) => g.items.length);
    const spaces = new Set(mine.map((t) => t.space.id)).size;
    const late = mine.filter(isLate).length;

    return (
      <div className="cu-pad">
        <div className="cu-head1">
          <div className="cu-titlebox">
            <span className="cu-crumbtxt">Across all spaces and lists</span>
            <div className="cu-tline"><h1 className="cu-title">My tasks</h1></div>
            <span className="cu-crumbtxt">{mine.length} open across {spaces} {spaces === 1 ? 'space' : 'spaces'}{late ? ` · ${late} overdue` : ''}</span>
          </div>
          <div className="cu-acts"><a className="cu-ghost" href={`https://app.clickup.com/${TEAM_ID}/home`} target="_blank" rel="noreferrer">Open in ClickUp ↗</a></div>
        </div>
        <div className="cu-toolbar">
          <div className="cu-filters">
            {FILTERS.map(([k, label, fn]) => { const n = mine.filter(fn).length; return <Link key={k} href={url('/clickup/mine', { ...base, f: k === 'all' ? undefined : k })} className={active[0] === k ? 'on' : ''}>{label}<span className={k === 'late' && n ? 'late' : ''}>{n}</span></Link>; })}
          </div>
          <form className="cu-search" action="/clickup/mine">
            {q.f && <input type="hidden" name="f" value={q.f} />}
            <span aria-hidden="true" /><input name="q" defaultValue={q.q ?? ''} placeholder="Search my tasks" aria-label="Search my tasks" />
          </form>
        </div>
        {q.error && <div className="cu-error" role="alert">{q.error.slice(0, 200)}</div>}

        <div className="cu-groups">
          {groups.map((g) => (
            <section key={g.name}>
              <h3 className={`cu-gh ${g.tone}`}>{g.name}<em>{g.items.length}</em></h3>
              <div className="cu-rows">
                {g.items.map((t) => <TaskRow key={t.id} t={t} href={url('/clickup/mine', { ...base, task: t.id })} on={t.id === q.task} where={`${t.folder?.name && t.folder.name !== 'hidden' ? `${t.folder.name} · ` : ''}${readableList(t.list.name).label}`} />)}
              </div>
            </section>
          ))}
          {!groups.length && <p className="muted" style={{ padding: '30px 4px' }}>{mine.length ? 'No tasks match these filters.' : 'No open tasks are assigned to you.'}</p>}
        </div>
        {mine.length >= 500 && <p className="muted" style={{ marginTop: 12 }}>Showing the first 500 tasks.</p>}
        {q.task && <TaskPanel userId={me.id} id={q.task} close={close} here={here} />}
      </div>
    );
  } catch (e) {
    return <Failed e={e} />;
  }
}
