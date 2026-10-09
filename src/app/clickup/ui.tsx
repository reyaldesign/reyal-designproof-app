import Link from 'next/link';
import { clickupAvailable, errorText, isConnected, type CuTask, type CuUser } from '@/lib/clickup';
import { colorFor, dueBadge, initialsOf, noteOf, progressOf, shortTitle } from '@/lib/clickupView';

/** Builds a /clickup link that keeps the current filters. A value of undefined drops that filter. */
export const url = (path: string, params: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return `${path}${s ? `?${s}` : ''}`;
};

export function Avatars({ people }: { people: CuUser[] }) {
  return (
    <span className="cu-who">
      {people.map((a) => <span key={a.id} className="cu-av" title={a.username} style={{ background: a.color || colorFor(a.username) }}>{(a.initials || initialsOf(a.username)).slice(0, 2)}</span>)}
    </span>
  );
}

export const Pill = ({ name, color }: { name: string; color: string }) => <span className="cu-pill" style={{ background: color }}>{name}</span>;

export function Due({ t }: { t: CuTask }) {
  const d = dueBadge(t);
  return d ? <span className={`cu-due ${d.tone}`}>{d.label}</span> : null;
}

export function Prio({ t }: { t: CuTask }) {
  if (!t.priority || t.priority.priority === 'normal') return null;
  return <span className="cu-prio"><span style={{ color: t.priority.color }}>⚑</span>{t.priority.priority[0].toUpperCase() + t.priority.priority.slice(1)}</span>;
}

/** A board card. It never repeats the client or list name, because the page header already says it. */
export function TaskCard({ t, href, on }: { t: CuTask; href: string; on: boolean }) {
  const note = noteOf(t);
  return (
    <Link href={href} className={`cu-card ${on ? 'on' : ''}`}>
      <b>{shortTitle(t)}</b>
      {note && <small>{note}</small>}
      <div className="cu-meta"><Due t={t} /><Prio t={t} /><span className="cu-end">{t.assignees.length ? <Avatars people={t.assignees} /> : <em>Unassigned</em>}</span></div>
    </Link>
  );
}

/** One line of the List view and My tasks: title, where it lives, status, due, people. */
export function TaskRow({ t, href, on, where }: { t: CuTask; href: string; on: boolean; where: string }) {
  const note = noteOf(t), p = progressOf(t), d = dueBadge(t);
  return (
    <Link href={href} className={`cu-row ${on ? 'on' : ''}`}>
      <span className="cu-rt"><b>{shortTitle(t)}</b>{note && <small>{note}</small>}</span>
      <span className="cu-where">{where}</span>
      <Pill name={p.name} color={p.color} />
      {d ? <span className={`cu-due ${d.tone}`}>{d.label}</span> : <span className="cu-due none">No date</span>}
      {t.assignees.length ? <Avatars people={t.assignees} /> : <em className="cu-none">None</em>}
    </Link>
  );
}

/** What to show instead of a page when ClickUp is not set up, not connected, or failed. Returns null when all is well. */
export async function gate(userId: string, error?: string) {
  const head = (children: React.ReactNode) => (
    <div className="cu-pad">
      <div className="cu-hrow"><h1 className="cu-title">Tasks</h1></div>
      {error && <div className="cu-error" role="alert">{error.slice(0, 200)}</div>}
      {children}
    </div>
  );
  if (!clickupAvailable()) return head(<div className="empty-state"><h2>ClickUp is not set up yet</h2><p>An admin needs to add CLICKUP_CLIENT_ID and CLICKUP_CLIENT_SECRET to the server settings.</p></div>);
  if (!(await isConnected(userId))) return head(<div className="empty-state"><h2>Connect your ClickUp account</h2><p style={{ marginBottom: 20 }}>One click. You approve access in ClickUp, then your tasks show up here.</p><a className="btn btn-primary" href="/api/clickup/connect">Connect ClickUp</a></div>);
  return null;
}

/** A failed ClickUp call, shown in place of the page. */
export const Failed = ({ e }: { e: unknown }) => (
  <div className="cu-pad"><div className="cu-error" role="alert">{errorText(e)}</div><a className="btn" href="/clickup">Try again</a></div>
);
