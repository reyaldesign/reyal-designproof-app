import Link from 'next/link';
import { cu, errorText, type CuComment, type CuField, type CuStatus, type CuTask, type CuUser } from '@/lib/clickup';
import { SPACE_NAME, between, clientOf, dayKey, fmtDay, mondayOf, progressOf, readableList, shift, todayKey } from '@/lib/clickupView';
import { addAttachment, addComment, assignee, setDue, setPriority, setProgress, setTitle } from './actions';
import { AttachButton, AutoDate, AutoText } from './Auto';
import Gallery from './Gallery';
import { Avatars } from './ui';

const IMAGE = /^(png|jpe?g|gif|webp|avif)$/i;
const PRIORITIES = [['1', 'Urgent', '#ff5c6c'], ['2', 'High', '#ffd308'], ['3', 'Normal', '#6aa9ff'], ['4', 'Low', '#8b8b95']] as const;
const when = (ms: string) => new Date(Number(ms)).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** A custom field as text, or '' when it is empty or holds something that is not readable (ids, people). */
function fieldText(f: CuField) {
  if (f.value == null || f.value === '') return '';
  if (f.type === 'drop_down') return f.type_config?.options?.find((o) => o.id === f.value || o.orderindex === Number(f.value))?.name ?? '';
  return ['short_text', 'text', 'url', 'email', 'phone', 'number', 'currency'].includes(f.type ?? '') && (typeof f.value === 'string' || typeof f.value === 'number') ? String(f.value) : '';
}

async function load(u: string, id: string) {
  const t = await cu<CuTask>(u, `/task/${encodeURIComponent(id)}`);
  const kind = progressOf(t).kind;
  const [{ comments }, members, statuses] = await Promise.all([
    cu<{ comments: CuComment[] }>(u, `/task/${encodeURIComponent(id)}/comment`),
    cu<{ members: CuUser[] }>(u, `/list/${t.list.id}/member`).then((r) => r.members).catch(() => [] as CuUser[]), // guests cannot list members
    kind === 'status' ? cu<{ statuses: CuStatus[] }>(u, `/list/${t.list.id}`).then((r) => r.statuses) : Promise.resolve([] as CuStatus[]),
  ]);
  return { t, comments, members, statuses };
}

function Menu({ trigger, cls, children }: { trigger: React.ReactNode; cls?: string; children: React.ReactNode }) {
  return <details className="cu-dd"><summary className={cls}>{trigger}</summary><div className="cu-ddm">{children}</div></details>;
}

/** The task drawer, 460px from the right over a dimmed page. close is the page address without the task, here is the address with it. */
export default async function TaskPanel({ userId, id, close, here }: { userId: string; id: string; close: string; here: string }) {
  const r = await load(userId, id).catch((e) => ({ error: errorText(e) }));
  const shell = (body: React.ReactNode) => <><Link className="cu-overlay" href={close} aria-label="Close task" /><aside className="cu-drawer">{body}</aside></>;
  if ('error' in r) return shell(<div className="cu-pb"><Link className="cu-x" href={close}>Close</Link><div className="cu-error">{r.error}</div></div>);

  const { t, comments, members, statuses } = r;
  const p = progressOf(t), read = readableList(t.list.name);
  const H = <><input type="hidden" name="task" value={t.id} /><input type="hidden" name="back" value={here} /></>;
  const today = todayKey();
  const dueKey = t.due_date ? dayKey(Number(t.due_date)) : '';
  const n = dueKey ? between(today, dueKey) : 0;
  const dueFull = !dueKey ? 'No due date' : `${n === 0 ? 'Today · ' : n === -1 ? 'Yesterday · ' : ''}${fmtDay(dueKey, { month: 'short', day: 'numeric' })}${n < -1 && !t.date_closed ? ` · ${-n} days late` : ''}`;
  const presets = [['Today', today], ['Tomorrow', shift(today, 1)], ['Monday', shift(mondayOf(today), 7)], ['In a week', shift(today, 7)]] as const;
  const fields = (t.custom_fields ?? []).filter((f) => f.name !== p.field?.name).map((f) => ({ k: f.name, v: fieldText(f) })).filter((f) => f.v);

  return shell(
    <>
      <div className="cu-ph">
        <span className="cu-crumb">{[SPACE_NAME, t.folder?.name, read.code || t.list.name].filter(Boolean).join(' / ')}</span>
        <a className="cu-open" href={t.url} target="_blank" rel="noreferrer">Open in ClickUp ↗</a>
        <Link className="cu-x" href={close}>Close</Link>
      </div>
      <div className="cu-pb">
        <form action={setTitle}>{H}<AutoText className="cu-ttl" name="title" defaultValue={t.name} aria-label="Task title" maxLength={200} /></form>
        <p className="cu-sub">{clientOf(t)} · {read.type || t.list.name}</p>

        <div className="cu-props">
          <span>Status</span>
          <Menu cls="cu-statuspill" trigger={<span style={{ background: p.color }}>{p.name} ▾</span>}>
            {p.kind === 'field'
              ? <>{[...p.options].sort((a, b) => a.orderindex - b.orderindex).map((o) => (
                  <form key={o.id} action={setProgress}>{H}<input type="hidden" name="field" value={p.field!.id} /><input type="hidden" name="value" value={o.id} /><button className="cu-opt"><i style={{ background: o.color }} />{o.name}{o.id === p.id && <em>✓</em>}</button></form>
                ))}<form action={setProgress}>{H}<input type="hidden" name="field" value={p.field!.id} /><input type="hidden" name="value" value="" /><button className="cu-opt"><i style={{ background: '#8b8b95' }} />No stage{!p.id && <em>✓</em>}</button></form></>
              : [...statuses].sort((a, b) => a.orderindex - b.orderindex).map((s) => (
                  <form key={s.status} action={setProgress}>{H}<input type="hidden" name="value" value={s.status} /><button className="cu-opt"><i style={{ background: s.color }} />{s.status}{s.status === t.status.status && <em>✓</em>}</button></form>
                ))}
          </Menu>

          <span>Assignees</span>
          <Menu cls="cu-people" trigger={<>{t.assignees.map((a) => <span key={a.id} className="cu-chipav"><Avatars people={[a]} />{a.username.split(' ')[0]}</span>)}<span className="cu-hint">{t.assignees.length ? '+ Edit' : 'Unassigned · + Assign'}</span></>}>
            {members.map((m) => {
              const on = t.assignees.some((a) => a.id === m.id);
              return <form key={m.id} action={assignee}>{H}<input type="hidden" name="user" value={m.id} /><input type="hidden" name="mode" value={on ? 'rem' : 'add'} /><button className="cu-opt"><Avatars people={[m]} />{m.username}{on && <em>✓</em>}</button></form>;
            })}
            {!members.length && <span className="cu-opt muted">No people to choose from.</span>}
          </Menu>

          <span>Due date</span>
          <Menu cls={`cu-field ${n < 0 && dueKey && !t.date_closed ? 'late' : ''}`} trigger={dueFull}>
            {presets.map(([label, key]) => <form key={label} action={setDue}>{H}<input type="hidden" name="due" value={key} /><button className="cu-opt">{label}<small>{fmtDay(key, { month: 'short', day: 'numeric' })}</small></button></form>)}
            <form action={setDue}>{H}<input type="hidden" name="due" value="" /><button className="cu-opt">No due date</button></form>
            <form action={setDue} className="cu-pick">{H}<AutoDate name="due" defaultValue={dueKey} aria-label="Pick a date" /></form>
          </Menu>

          <span>Priority</span>
          <Menu cls="cu-field" trigger={<><span style={{ color: t.priority?.color ?? '#8b8b95' }}>⚑</span> {t.priority ? t.priority.priority[0].toUpperCase() + t.priority.priority.slice(1) : 'None'}</>}>
            {PRIORITIES.map(([v, label, c]) => <form key={v} action={setPriority}>{H}<input type="hidden" name="priority" value={v} /><button className="cu-opt"><span style={{ color: c }}>⚑</span>{label}{t.priority?.id === v && <em>✓</em>}</button></form>)}
            <form action={setPriority}>{H}<input type="hidden" name="priority" value="" /><button className="cu-opt"><span style={{ color: '#8b8b95' }}>⚑</span>None{!t.priority && <em>✓</em>}</button></form>
          </Menu>

          <span>Tags</span>
          <div>{t.tags.length ? t.tags.map((g) => <span key={g.name} className="cu-tagpill">{g.name}</span>) : <span className="muted">None</span>}</div>
        </div>
        <div className="cu-fields">
          {[{ k: 'Client', v: clientOf(t) }, { k: 'List', v: read.code || t.list.name }, ...fields].map((f) => <div key={f.k}><span>{f.k}</span><b>{f.v}</b></div>)}
        </div>

        {(t.text_content || t.description) && <p className="cu-desc">{t.text_content || t.description}</p>}
        {!!t.attachments?.length && (
          <div className="cu-att"><span>Attachments</span>
            <Gallery items={t.attachments.map((a) => ({ id: a.id, title: a.title, url: a.url, thumb: a.thumbnail_large || a.url, image: IMAGE.test(a.extension ?? '') }))} />
          </div>
        )}
        <h3 className="cu-ch">Comments {comments.length > 0 && <span>{comments.length}</span>}</h3>
        {comments.map((c) => (
          <div key={c.id} className="cu-c"><Avatars people={[c.user]} /><div><b>{c.user.username}</b><span className="muted"> · {when(c.date)}</span><p>{c.comment_text}</p></div></div>
        ))}
        {!comments.length && <p className="muted">No comments yet.</p>}
      </div>
      <div className="cu-cbar">
        <form action={addAttachment}>{H}<AttachButton /></form>
        <form action={addComment} className="cu-cbox">{H}
          <input className="input" name="text" placeholder="Comment, synced to ClickUp" autoComplete="off" required />
          <button className="btn btn-primary">Comment</button>
        </form>
      </div>
    </>,
  );
}
