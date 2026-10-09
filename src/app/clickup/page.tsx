import Link from 'next/link';
import { requireTool } from '@/lib/access';
import type { CuTask } from '@/lib/clickup';
import { allSpaces, folderLists, listFields, listMembers, listMeta, listTasks, spaceTags, spaceTree, whoAmI } from '@/lib/clickupData';
import { BOARD_LIST_ID, PROGRESS_FIELD, TEAM_ID, colorFor, fmtDay, isDone, isLate, isThisWeek, mondayOf, noteOf, progressOf, readableList, shift, todayKey, typeDot } from '@/lib/clickupView';
import NewTaskModal, { type ListCfg } from './NewTaskModal';
import TaskPanel from './TaskPanel';
import { Failed, TaskCard, TaskRow, gate, url } from './ui';

type Q = { list?: string; view?: string; f?: string; q?: string; task?: string; new?: string; col?: string; due?: string; n?: string; error?: string };
type Col = { key: string; value: string; name: string; color: string };

export default async function Board({ searchParams }: { searchParams: Promise<Q> }) {
  const me = await requireTool('CLICKUP');
  const q = await searchParams;
  const blocked = await gate(me.id, q.error);
  if (blocked) return blocked;

  const listId = q.list || BOARD_LIST_ID;
  const asList = q.view === 'list';
  const base = { list: q.list, view: q.view, f: q.f, q: q.q };
  const here = url('/clickup', { ...base, task: q.task });
  const close = url('/clickup', base);

  try {
    const [who, spaces, meta, fields, all] = await Promise.all([whoAmI(me.id), allSpaces(me.id), listMeta(me.id, listId), listFields(me.id, listId), listTasks(me.id, listId)]);
    const folder = meta.folder && !meta.folder.hidden ? meta.folder : null;
    const space = spaces.find((s) => s.id === meta.space?.id);
    const siblings = folder ? await folderLists(me.id, folder.id) : meta.space ? (await spaceTree(me.id, meta.space.id)).loose : [];
    const read = readableList(meta.name);
    const title = folder && folder.name !== read.label ? `${folder.name} · ${read.label}` : read.label;

    // Columns are the progress dropdown where the list has one, otherwise the list's own ClickUp statuses.
    const pf = fields.find((f) => f.name === PROGRESS_FIELD && f.type === 'drop_down');
    const cols: Col[] = pf
      ? [...(pf.type_config?.options ?? [])].sort((a, b) => a.orderindex - b.orderindex).map((o) => ({ key: o.id, value: o.id, name: o.name, color: o.color }))
      : [...meta.statuses].sort((a, b) => a.orderindex - b.orderindex).map((s) => ({ key: s.status.toLowerCase(), value: s.status, name: s.status, color: s.color }));
    const keyOf = (t: CuTask) => (pf ? progressOf(t).id : t.status.status.toLowerCase());
    const columns = pf && all.some((t) => !keyOf(t) && !isDone(t)) ? [{ key: '', value: '', name: 'No stage', color: '#8b8b95' }, ...cols] : cols;
    const pool = pf ? all.filter((t) => keyOf(t) || !isDone(t)) : all; // a finished task with no stage has no column to sit in

    const FILTERS: [string, string, (t: CuTask) => boolean][] = [
      ['all', 'All', () => true], ['late', 'Overdue', isLate], ['week', 'This week', isThisWeek],
      ['none', 'Unassigned', (t) => !t.assignees.length], ['me', 'Mine', (t) => t.assignees.some((a) => a.id === who.id)],
    ];
    const active = FILTERS.find(([k]) => k === q.f) ?? FILTERS[0];
    const needle = (q.q ?? '').toLowerCase();
    const shown = pool.filter((t) => active[2](t) && (!needle || `${t.name} ${noteOf(t)}`.toLowerCase().includes(needle)));
    const filtered = active[0] !== 'all' || !!needle;

    const groups = columns.map((c) => ({ c, items: shown.filter((t) => keyOf(t) === c.key) }));

    // The popup lets you move the task to another list in the folder, so it needs each list's own statuses, fields and codes.
    let modal: React.ReactNode = null;
    if (q.new && !q.task) {
      const today = todayKey();
      const choices = siblings.some((l) => l.id === listId) ? siblings : [{ id: listId, name: meta.name }, ...siblings];
      const lists: ListCfg[] = await Promise.all(choices.map(async (l) => {
        const [m, fs] = l.id === listId ? [meta, fields] : await Promise.all([listMeta(me.id, l.id), listFields(me.id, l.id)]);
        const sf = fs.find((f) => f.name === PROGRESS_FIELD && f.type === 'drop_down');
        const stages = sf
          ? [...(sf.type_config?.options ?? [])].sort((a, b) => a.orderindex - b.orderindex).map((o) => ({ value: o.id, label: o.name, color: o.color }))
          : [...m.statuses].sort((a, b) => a.orderindex - b.orderindex).map((s) => ({ value: s.status, label: s.status, color: s.color }));
        const nf = fs.find((f) => f.name !== PROGRESS_FIELD && (f.type === 'short_text' || f.type === 'text'));
        const r = readableList(l.name);
        return { id: l.id, label: r.label, code: r.code, dot: typeDot(r.type) || colorFor(l.name), stages, stageField: sf?.id ?? '', note: nf ? { id: nf.id, name: nf.name } : null };
      }));
      const [people, tags] = await Promise.all([listMembers(me.id, listId).catch(() => []), meta.space ? spaceTags(me.id, meta.space.id).catch(() => []) : []]);
      const presets = [['Today', today], ['Tomorrow', shift(today, 1)], ['Monday', shift(mondayOf(today), 7)], ['In a week', shift(today, 7)]].map(([label, key]) => ({ label, key, hint: fmtDay(key, { month: 'short', day: 'numeric' }) }));
      modal = <NewTaskModal key={q.n ?? 'first'} lists={lists} listId={listId} stage={q.col ?? ''} due={/^\d{4}-\d{2}-\d{2}$/.test(q.due ?? '') ? q.due! : ''} people={people.map((p) => ({ id: p.id, name: p.username, color: p.color || colorFor(p.username) }))} tags={tags} client={folder?.name ?? space?.name ?? ''} presets={presets} close={close} />;
    }

    return (
      <div className="cu-pad">
        <div className="cu-head1">
          <div className="cu-titlebox">
            <span className="cu-crumbtxt">{[space?.name, folder?.name].filter(Boolean).join(' / ')}</span>
            <div className="cu-tline"><h1 className="cu-title">{title}</h1>{read.code && <span className="cu-code">{read.code}</span>}</div>
          </div>
          <div className="cu-acts">
            <a className="cu-ghost" href={`https://app.clickup.com/${TEAM_ID}/v/l/li/${listId}`} target="_blank" rel="noreferrer">Open in ClickUp ↗</a>
            <Link className="cu-red" href={url('/clickup', { ...base, new: '1' })}>+ Task</Link>
          </div>
        </div>
        {siblings.length > 1 && (
          <div className="cu-tabs">
            {siblings.map((l) => <Link key={l.id} href={url('/clickup', { list: l.id })} className={l.id === listId ? 'on' : ''}>{readableList(l.name).label}<span>{Number(l.task_count) || ''}</span></Link>)}
          </div>
        )}
        <div className="cu-toolbar">
          <div className="cu-seg" role="group" aria-label="View">
            <Link href={url('/clickup', { ...base, view: undefined })} className={!asList ? 'on' : ''}>Board</Link>
            <Link href={url('/clickup', { ...base, view: 'list' })} className={asList ? 'on' : ''}>List</Link>
          </div>
          <div className="cu-filters">
            {FILTERS.map(([k, label, fn]) => { const n = pool.filter(fn).length; return <Link key={k} href={url('/clickup', { ...base, f: k === 'all' ? undefined : k })} className={active[0] === k ? 'on' : ''}>{label}<span className={k === 'late' && n ? 'late' : ''}>{n}</span></Link>; })}
          </div>
          <form className="cu-search" action="/clickup">
            {(['list', 'view', 'f'] as const).map((k) => q[k] && <input key={k} type="hidden" name={k} value={q[k]} />)}
            <span aria-hidden="true" /><input name="q" defaultValue={q.q ?? ''} placeholder="Search this list" aria-label="Search this list" />
          </form>
        </div>
        {q.error && <div className="cu-error" role="alert">{q.error.slice(0, 200)}</div>}

        {!asList && (
          <div className="cu-board" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(230px, 1fr))` }}>
            {groups.map(({ c, items }) => (
              <section key={c.key} className="cu-col">
                <h3><span className="cu-pill" style={{ background: c.color }}>{c.name}</span><em>{items.length}</em><Link className="cu-plus" href={url('/clickup', { ...base, new: '1', col: c.value })} aria-label={`Add a task to ${c.name}`}>+</Link></h3>
                <div className="cu-cards">
                  {items.map((t) => <TaskCard key={t.id} t={t} href={url('/clickup', { ...base, task: t.id })} on={t.id === q.task} />)}
                  {!items.length && <div className="cu-emptybox"><span>{filtered ? 'None match this filter' : 'No tasks'}</span><Link className="cu-add" href={url('/clickup', { ...base, new: '1', col: c.value })}>+ Add task</Link></div>}
                </div>
                {!!items.length && <Link className="cu-add" href={url('/clickup', { ...base, new: '1', col: c.value })}>+ Add task</Link>}
              </section>
            ))}
          </div>
        )}

        {asList && (
          <div className="cu-groups">
            {groups.filter((g) => g.items.length).map(({ c, items }) => (
              <section key={c.key}>
                <h3 className="cu-gh"><i style={{ background: c.color }} />{c.name}<em>{items.length}</em></h3>
                <div className="cu-rows">{items.map((t) => <TaskRow key={t.id} t={t} href={url('/clickup', { ...base, task: t.id })} on={t.id === q.task} where={read.label} />)}</div>
              </section>
            ))}
            {!shown.length && <p className="muted" style={{ padding: '30px 4px' }}>No tasks match these filters.</p>}
          </div>
        )}
        {all.length >= 500 && <p className="muted" style={{ marginTop: 12 }}>Showing the first 500 tasks.</p>}
        {q.task && <TaskPanel userId={me.id} id={q.task} close={close} here={here} />}
        {modal}
      </div>
    );
  } catch (e) {
    return <Failed e={e} />;
  }
}
