'use client';

import { useRef, useState, useTransition } from 'react';
import { ROLES, ROLE_LABEL, TOOLS } from '@/lib/accessShared';
import { approveUser, denyUser, preAssign, reactivateUser, setRole, setRoleTool, setToolForUser, signOutEverywhere, suspendUser } from './actions';

export type TeamMember = {
  id: string; email: string; name: string; role: string | null; status: string;
  lastSignInAt: string | null; createdAt: string; device: string;
  tools: string[]; overrides: Record<string, boolean>; sessions: { id: string; device: string; seen: string }[];
};
export type TeamEvent = { id: string; at: string; email: string; kind: string; detail: string; device: string; ip: string };
type Result = { error?: string };

const ROLE_STYLE: Record<string, { c: string; bg: string }> = {
  ADMIN: { c: '#ff8a9a', bg: 'rgba(196,19,47,.22)' },
  PM: { c: '#6aa9ff', bg: 'rgba(106,169,255,.16)' },
  DESIGNER: { c: '#3ddc97', bg: 'rgba(61,220,151,.13)' },
};
const STATUS: Record<string, { label: string; c: string }> = {
  ACTIVE: { label: 'Active', c: '#3ddc97' }, SUSPENDED: { label: 'Suspended', c: '#ff5c6c' }, DENIED: { label: 'Denied', c: '#8b8b95' },
};
const KIND: Record<string, [string, string]> = {
  SIGNED_IN: ['#3ddc97', '#f6f6f7'], FIRST_SIGN_IN: ['#ffd308', '#ffe36b'], ACCESS_REQUESTED: ['#ffd308', '#ffe36b'],
  BLOCKED_DOMAIN: ['#ff5c6c', '#ff8a96'], BLOCKED_SUSPENDED: ['#ff5c6c', '#ff8a96'], BLOCKED_DENIED: ['#ff5c6c', '#ff8a96'], BLOCKED_PASSWORD: ['#ff5c6c', '#ff8a96'],
  ACCESS_CHANGED: ['#6aa9ff', '#f6f6f7'], SIGNED_OUT: ['#52525b', '#c7c7cd'],
};
const kindOf = (e: TeamEvent): [string, string] => (e.kind === 'SIGNED_IN' && /waiting/i.test(e.detail) ? KIND.FIRST_SIGN_IN : KIND[e.kind] ?? KIND.SIGNED_OUT);
const nameOf = (m: { name: string; email: string }) => m.name || m.email.split('@')[0];

// Times are shown in the viewer's own time zone, so the server and browser text can differ for a moment.
const day0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
function when(iso: string) {
  const d = new Date(iso), diff = Math.round((day0(new Date()) - day0(d)) / 864e5);
  const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return diff === 0 ? `Today ${t}` : diff === 1 ? `Yesterday ${t}` : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${t}`;
}
function ago(iso: string | null) {
  if (!iso) return 'Never';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} hour${m < 120 ? '' : 's'} ago`;
  return m < 2880 ? 'Yesterday' : new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function Switch({ on, onClick, locked, label }: { on: boolean; onClick: () => void; locked?: boolean; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`tm-switch ${on ? 'on' : ''}`} disabled={locked} onClick={onClick}><i /></button>;
}
const RolePill = ({ role }: { role: string | null }) => {
  const s = role ? ROLE_STYLE[role] : null;
  return <span className="tm-pill" style={s ? { color: s.c, background: s.bg } : undefined}>{role ? ROLE_LABEL[role as keyof typeof ROLE_LABEL] : 'No role'}</span>;
};

export default function TeamApp({ me, members, matrix, events }: { me: string; members: TeamMember[]; matrix: Record<string, string[]>; events: TeamEvent[] }) {
  const [tab, setTab] = useState<'members' | 'roles' | 'log'>('members');
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  const [lf, setLf] = useState<'all' | 'ok' | 'blocked'>('all');
  const [who, setWho] = useState('');
  const [range, setRange] = useState('7');
  const dlg = useRef<HTMLDialogElement>(null);

  const run = (fn: () => Promise<Result>) => start(async () => { const r = await fn(); setErr(r.error ?? ''); });
  const pending = members.filter((m) => m.status === 'PENDING');
  const team = members.filter((m) => m.status !== 'PENDING');
  const dm = team.find((m) => m.id === open) ?? null;
  const count = (r: string) => team.filter((m) => m.role === r && m.status === 'ACTIVE').length;

  const shown = events.filter((e) => {
    const [dot] = kindOf(e);
    if (lf === 'ok' && dot !== '#3ddc97') return false;
    if (lf === 'blocked' && dot !== '#ff5c6c' && dot !== '#ffd308') return false;
    if (who && e.email !== who) return false;
    return range === 'all' || Date.now() - new Date(e.at).getTime() <= Number(range) * 864e5;
  });
  const exportCsv = () => {
    const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = [['When', 'Account', 'Event', 'Device', 'IP'], ...shown.map((e) => [new Date(e.at).toISOString(), e.email, e.detail, e.device, e.ip])];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map(q).join(',')).join('\n')], { type: 'text/csv' }));
    a.download = 'sign-in-activity.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="page tm">
      <div className="page-head">
        <div>
          <h1 className="h1">Team &amp; access</h1>
          <p className="muted" style={{ marginTop: 8 }}>Google sign-in · only company accounts can sign in</p>
        </div>
        <button className="btn btn-primary" onClick={() => dlg.current?.showModal()}>+ Pre-assign a role</button>
      </div>

      <div className="tm-tabs" role="tablist">
        {([['members', 'Members', team.length], ['roles', 'Roles & permissions', ROLES.length], ['log', 'Sign-in activity', events.length]] as const).map(([k, label, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}<small>{n}</small></button>
        ))}
      </div>
      {err && <p className="tm-err" role="alert">{err}</p>}

      {tab === 'members' && (
        <>
          {pending.map((p) => (
            <div key={p.id} className="tm-pending">
              <span className="tm-av">{nameOf(p).charAt(0).toUpperCase()}</span>
              <div className="tm-who">
                <b>{nameOf(p)} <em>NEW · NO ROLE YET</em></b>
                <small>{p.email} · first sign-in <span suppressHydrationWarning>{ago(p.lastSignInAt ?? p.createdAt)}</span>{p.device && ` · ${p.device}`}</small>
              </div>
              <div className="tm-give">
                <small>Give access as</small>
                <button className="btn tm-w" disabled={busy} onClick={() => run(() => approveUser(p.id, 'DESIGNER'))}>Designer</button>
                <button className="btn-ghost" disabled={busy} onClick={() => run(() => approveUser(p.id, 'PM'))}>Project Manager</button>
                <button className="btn-ghost" disabled={busy} onClick={() => run(() => approveUser(p.id, 'ADMIN'))}>Admin</button>
                <button className="tm-link" disabled={busy} onClick={() => run(() => denyUser(p.id))}>Deny</button>
              </div>
            </div>
          ))}
          <div className="tm-table">
            <div className="tm-row tm-head tm-cols-m"><span>Member</span><span>Role</span><span>Can use</span><span>Last sign-in</span><span>Status</span></div>
            {team.map((m) => {
              const st = STATUS[m.status] ?? STATUS.DENIED;
              return (
                <div key={m.id} className={`tm-row tm-cols-m tm-click ${open === m.id ? 'sel' : ''}`} role="button" tabIndex={0} onClick={() => setOpen(m.id)} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(m.id); }}>
                  <div className="tm-who tm-who-row"><span className="tm-av">{nameOf(m).charAt(0).toUpperCase()}</span><div><b>{nameOf(m)}</b><small>{m.email}</small></div></div>
                  <span><RolePill role={m.role} /></span>
                  <div className="tm-chips">{m.tools.map((t) => <span key={t} className={`tm-chip ${t in m.overrides ? 'own' : ''}`}>{TOOLS.find((x) => x.key === t)?.label}</span>)}</div>
                  <div className="tm-who"><span suppressHydrationWarning>{m.lastSignInAt ? ago(m.lastSignInAt) : 'Not yet'}</span><small>{m.device}</small></div>
                  <span className="tm-status" style={{ color: st.c }}><i style={{ background: st.c }} />{st.label}</span>
                </div>
              );
            })}
          </div>
          <p className="tm-note">A dashed outline marks a tool given to or removed from that person only, not by their role.</p>
        </>
      )}

      {tab === 'roles' && (
        <>
          <div className="tm-table">
            <div className="tm-row tm-head tm-cols-r">
              <span>Tool</span>
              {ROLES.map((r) => <div key={r} className="tm-rolehead"><span className="tm-pill" style={{ color: ROLE_STYLE[r].c, background: ROLE_STYLE[r].bg }}>{ROLE_LABEL[r]}</span><small>{count(r)} {count(r) === 1 ? 'person' : 'people'}</small></div>)}
            </div>
            {TOOLS.map((t) => (
              <div key={t.key} className="tm-row tm-cols-r">
                <div className="tm-who"><b>{t.label}</b><small>{t.d}</small></div>
                {ROLES.map((r) => {
                  const on = matrix[r]?.includes(t.key) || (r === 'ADMIN' && t.key === 'TEAM'), locked = r === 'ADMIN' && t.key === 'TEAM';
                  return <div key={r} className="tm-cell"><Switch on={on} locked={locked || busy} label={`${t.label} for ${ROLE_LABEL[r]}`} onClick={() => run(() => setRoleTool(r, t.key, !on))} /></div>;
                })}
              </div>
            ))}
          </div>
          <p className="tm-note">Admins always keep Team &amp; access, so nobody can lock the team out. Changes apply the next time each person loads a page.</p>
        </>
      )}

      {tab === 'log' && (
        <>
          <div className="tm-filters">
            <div className="tm-seg">
              {([['all', 'All'], ['ok', 'Successful'], ['blocked', 'Blocked & waiting']] as const).map(([k, label]) => <button key={k} className={lf === k ? 'on' : ''} onClick={() => setLf(k)}>{label}</button>)}
            </div>
            <select className="tm-select" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Person">
              <option value="">Everyone</option>
              {[...new Set(events.map((e) => e.email))].sort().map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <select className="tm-select" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Date range">
              <option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="all">All time</option>
            </select>
            <button className="tm-link tm-export" onClick={exportCsv}>Export CSV</button>
          </div>
          <div className="tm-table">
            <div className="tm-row tm-head tm-cols-l"><span>When</span><span>Account</span><span>Event</span><span>Device</span><span>IP</span></div>
            {!shown.length && <p className="tm-empty">Nothing here for those filters.</p>}
            {shown.map((e) => {
              const [dot, tc] = kindOf(e);
              return (
                <div key={e.id} className="tm-row tm-cols-l tm-logrow">
                  <span suppressHydrationWarning>{when(e.at)}</span>
                  <span className="tm-ell">{e.email}</span>
                  <span className="tm-ev"><i style={{ background: dot }} /><span style={{ color: tc }}>{e.detail || e.kind}</span></span>
                  <span className="tm-dim">{e.device}</span>
                  <span className="tm-dim">{e.ip}</span>
                </div>
              );
            })}
          </div>
          <p className="tm-note">History is kept for 12 months. City lookup is not set up, so only the IP address is shown.</p>
        </>
      )}

      {dm && (
        <>
          <div className="tm-overlay" onClick={() => setOpen(null)} />
          <aside className="tm-drawer" aria-label={`${nameOf(dm)} details`}>
            <div className="tm-dhead">
              <span className="tm-av big">{nameOf(dm).charAt(0).toUpperCase()}</span>
              <div className="tm-who"><b>{nameOf(dm)}</b><small>{dm.email}</small></div>
              <button className="tm-link" onClick={() => setOpen(null)}>Close</button>
            </div>
            <div className="tm-dbody">
              <div><span className="tm-lab">Role</span>
                <div className="tm-roles">
                  {ROLES.map((r) => <button key={r} disabled={busy} className={dm.role === r ? 'on' : ''} style={dm.role === r ? { borderColor: ROLE_STYLE[r].c, background: ROLE_STYLE[r].bg, color: ROLE_STYLE[r].c } : undefined} onClick={() => dm.role !== r && run(() => setRole(dm.id, r))}>{ROLE_LABEL[r]}</button>)}
                </div>
              </div>
              <div><span className="tm-lab">Tools</span>
                {TOOLS.map((t) => {
                  const on = dm.tools.includes(t.key), fromRole = !!dm.role && (matrix[dm.role]?.includes(t.key) || (dm.role === 'ADMIN' && t.key === 'TEAM')), over = on !== fromRole;
                  const roleName = dm.role ? ROLE_LABEL[dm.role as keyof typeof ROLE_LABEL] : 'any';
                  return (
                    <div key={t.key} className="tm-tool">
                      <div className="tm-who"><b>{t.label}</b><small style={{ color: over ? '#ffd308' : undefined }}>{over ? (on ? 'Given to this person only' : 'Removed for this person only') : on ? `From ${roleName} role` : `Not in ${roleName} role`}</small></div>
                      <Switch on={on} locked={busy || (dm.role === 'ADMIN' && t.key === 'TEAM')} label={t.label} onClick={() => run(() => setToolForUser(dm.id, t.key, !on))} />
                    </div>
                  );
                })}
              </div>
              <div><span className="tm-lab">Signed in on</span>
                {dm.sessions.length ? dm.sessions.map((s) => <div key={s.id} className="tm-sess"><span>{s.device}</span><small suppressHydrationWarning>Last seen {ago(s.seen).toLowerCase()}</small></div>) : <div className="tm-sess"><span>No active sessions</span></div>}
                {dm.sessions.length > 0 && <button className="btn-ghost" disabled={busy} onClick={() => run(() => signOutEverywhere(dm.id))}>Sign out of all devices</button>}
              </div>
              <div className="tm-danger">
                <span className="tm-lab bad">Access</span>
                {dm.status === 'SUSPENDED'
                  ? <button className="btn-ghost" disabled={busy} onClick={() => run(() => reactivateUser(dm.id))}>Reactivate {nameOf(dm).split(' ')[0]}</button>
                  : <button className="btn-ghost tm-suspend" disabled={busy || dm.email === me} onClick={() => run(() => suspendUser(dm.id))}>Suspend {nameOf(dm).split(' ')[0]}</button>}
                <small className="muted">{dm.status === 'SUSPENDED' ? 'They cannot sign in until reactivated.' : "They're signed out right away and can't sign back in until reactivated. Their proofs and comments stay."}</small>
              </div>
            </div>
          </aside>
        </>
      )}

      <dialog ref={dlg} className="dlg" onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
        <h2>Pre-assign a role</h2>
        <form onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget, f = new FormData(form);
          start(async () => { const r = await preAssign(String(f.get('email')), String(f.get('role'))); setErr(r.error ?? ''); if (!r.error) { dlg.current?.close(); form.reset(); } });
        }}>
          {err && <p className="tm-err" role="alert">{err}</p>}
          <p className="muted">They get this role the first time they sign in with Google, with no waiting.</p>
          <input className="input" name="email" type="email" placeholder="name@reyaldesign.com" required />
          <select className="input" name="role" defaultValue="DESIGNER">{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
          <div className="tm-dlgbtns"><button type="button" className="btn" onClick={() => dlg.current?.close()}>Cancel</button><button className="btn btn-primary" disabled={busy}>Pre-assign</button></div>
        </form>
      </dialog>
    </div>
  );
}
