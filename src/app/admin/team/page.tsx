import { ROLES, deviceOf, requireTool, toolsFor } from '@/lib/access';
import { db } from '@/lib/db';
import TeamApp, { type TeamEvent, type TeamMember } from './TeamApp';
import './team.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Team & access' };

export default async function TeamPage() {
  const me = await requireTool('TEAM');
  const [users, perms, events] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: 'asc' }, include: { overrides: true, sessions: { orderBy: { lastSeenAt: 'desc' } } } }),
    db.rolePermission.findMany(),
    db.signInEvent.findMany({ orderBy: { at: 'desc' }, take: 500 }),
  ]);
  const members: TeamMember[] = await Promise.all(users.map(async (u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    lastSignInAt: u.lastSignInAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    device: u.sessions[0] ? deviceOf(u.sessions[0].userAgent) : '',
    tools: await toolsFor(u.role, u.overrides),
    overrides: Object.fromEntries(u.overrides.map((o) => [o.tool, o.granted])),
    sessions: u.sessions.map((s) => ({ id: s.id, device: deviceOf(s.userAgent), seen: s.lastSeenAt.toISOString() })),
  })));
  const matrix = Object.fromEntries(ROLES.map((r) => [r, perms.filter((p) => p.role === r).map((p) => p.tool)]));
  const log: TeamEvent[] = events.map((e) => ({ id: e.id, at: e.at.toISOString(), email: e.email, kind: e.kind, detail: e.detail, device: deviceOf(e.userAgent), ip: e.ip }));
  return <TeamApp me={me.email} members={members} matrix={matrix} events={log} />;
}
