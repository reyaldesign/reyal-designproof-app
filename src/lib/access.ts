import { randomBytes } from 'node:crypto';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cookieOpts, safeEq, sign } from './auth';
import { db } from './db';
import { isAllowed } from './google';
import { notify } from './mail';

export * from './accessShared';
import { TOOLS, type Tool } from './accessShared';

const COOKIE = 'rp_session';
const aiOn = () => process.env.AI_REVIEWER_ENABLED === 'true';

export type Me = { id: string; email: string; name: string; role: string | null; status: string; tools: Tool[] };

/** Tools a role gives, plus the person's own grants, minus what was taken from them. Admins always keep Team & access. */
export async function toolsFor(role: string | null, overrides: { tool: string; granted: boolean }[]): Promise<Tool[]> {
  const base = new Set((role ? await db.rolePermission.findMany({ where: { role } }) : []).map((r) => r.tool));
  if (role === 'ADMIN') base.add('TEAM');
  for (const o of overrides) {
    if (o.granted) base.add(o.tool);
    else if (!(role === 'ADMIN' && o.tool === 'TEAM')) base.delete(o.tool);
  }
  return TOOLS.map((t) => t.key).filter((k) => base.has(k));
}

/** The signed-in person, read from the database on every request, so suspending or changing someone applies at once. */
export const getMe = cache(async (): Promise<Me | null> => {
  const c = (await cookies()).get(COOKIE)?.value;
  const [id, sig] = (c ?? '').split('.');
  if (!id || !sig || !safeEq(sig, sign(`sess:${id}`))) return null;
  const s = await db.session.findUnique({ where: { id }, include: { user: { include: { overrides: true } } } });
  if (!s || (s.user.status !== 'ACTIVE' && s.user.status !== 'PENDING')) return null;
  if (Date.now() - s.lastSeenAt.getTime() > 5 * 60_000) db.session.update({ where: { id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  const u = s.user;
  const tools = u.status === 'ACTIVE' ? await toolsFor(u.role, u.overrides) : [];
  return { id: u.id, email: u.email, name: u.name || u.email.split('@')[0], role: u.role, status: u.status, tools };
});

export const homeFor = (tools: Tool[]) => TOOLS.find((t) => tools.includes(t.key) && (aiOn() || !t.key.startsWith('AI_')))?.href ?? '/no-access';

/** Pages and server actions: sign-in required. Pending people go to the waiting screen. */
export async function requireMe() {
  const me = await getMe();
  if (!me) redirect('/login');
  if (me.status === 'PENDING') redirect('/waiting');
  return me;
}
export async function requireTool(tool: Tool) {
  const me = await requireMe();
  if (!me.tools.includes(tool)) redirect(`/no-access?tool=${tool}`);
  return me;
}
/** API routes: a Response to send back when the request must be refused, otherwise null. */
export async function refuseTool(tool: Tool): Promise<Response | null> {
  const me = await getMe();
  if (!me) return Response.json({ error: 'Please sign in again.' }, { status: 401 });
  if (!me.tools.includes(tool)) return Response.json({ error: 'You do not have access to this.' }, { status: 403 });
  return null;
}
export async function can(tool: Tool) {
  return !!(await getMe())?.tools.includes(tool);
}

// ----- sign-in log -----
export function deviceOf(ua: string) {
  const b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const o = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return o ? `${b} · ${o}` : b;
}
/** The visitor's address as nginx saw it. X-Real-IP is set by nginx itself, so it cannot be faked the way the first X-Forwarded-For entry can. */
export async function clientIp() {
  const h = await headers();
  return h.get('x-real-ip') || (h.get('x-forwarded-for') ?? '').split(',').pop()?.trim() || '';
}
async function clientInfo() {
  return { ip: await clientIp(), userAgent: ((await headers()).get('user-agent') ?? '').slice(0, 300) };
}
export async function logEvent(e: { email: string; kind: string; detail?: string; actor?: string }) {
  await db.signInEvent.create({ data: { email: e.email, kind: e.kind, detail: e.detail ?? '', actor: e.actor, ...(await clientInfo()) } });
  // Keep 12 months of history.
  db.signInEvent.deleteMany({ where: { at: { lt: new Date(Date.now() - 365 * 864e5) } } }).catch(() => {});
}
export async function adminEmails() {
  const admins = await db.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { email: true } });
  return [...new Set([...admins.map((a) => a.email), ...(process.env.NOTIFY_EMAIL ? [process.env.NOTIFY_EMAIL] : [])])];
}

// ----- sign in and out -----
export type SignInResult = { ok: true; to: string } | { ok: false; error: 'denied' | 'suspended' | 'refused' };

/** Shared by Google and password sign-in. breakGlass is the ADMIN_EMAIL password login: it always ends up an active admin, so a bad setup cannot lock everyone out. */
export async function signIn(rawEmail: string, opts: { name?: string; via: string; breakGlass?: boolean }): Promise<SignInResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!opts.breakGlass && !isAllowed(email)) {
    await logEvent({ email, kind: 'BLOCKED_DOMAIN', detail: 'Blocked · not an allowed account' });
    return { ok: false, error: 'denied' };
  }
  const owner = email === (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  let u = await db.user.findUnique({ where: { email }, include: { overrides: true } });
  const first = !u;
  if (!u) u = await db.user.create({ data: { email, name: opts.name ?? '', role: owner ? 'ADMIN' : null, status: owner ? 'ACTIVE' : 'PENDING' }, include: { overrides: true } });
  else if (opts.breakGlass && (u.role !== 'ADMIN' || u.status !== 'ACTIVE')) u = await db.user.update({ where: { id: u.id }, data: { role: 'ADMIN', status: 'ACTIVE' }, include: { overrides: true } });
  if (u.status === 'SUSPENDED') { await logEvent({ email, kind: 'BLOCKED_SUSPENDED', detail: 'Blocked · account suspended' }); return { ok: false, error: 'suspended' }; }
  if (u.status === 'DENIED') { await logEvent({ email, kind: 'BLOCKED_DENIED', detail: 'Blocked · access was denied' }); return { ok: false, error: 'refused' }; }

  await db.user.update({ where: { id: u.id }, data: { lastSignInAt: new Date(), ...(!u.name && opts.name ? { name: opts.name } : {}) } });
  const id = randomBytes(24).toString('base64url');
  await db.session.create({ data: { id, userId: u.id, ...(await clientInfo()) } });
  const jar = await cookies();
  jar.set(COOKIE, `${id}.${sign(`sess:${id}`)}`, cookieOpts);
  jar.delete('rp_admin'); // cookies from before roles existed
  jar.delete('rp_user');

  if (u.status === 'PENDING') {
    await logEvent({ email, kind: first ? 'FIRST_SIGN_IN' : 'SIGNED_IN', detail: first ? 'First sign-in · waiting for a role' : 'Signed in · waiting for a role' });
    if (first) notify(`${email} is waiting for access`, `${email} signed in to Reyal Design Studio for the first time and has no role yet.\n\nGive them a role: ${process.env.APP_URL || ''}/admin/team`, await adminEmails()).catch(() => {});
    return { ok: true, to: '/waiting' };
  }
  await logEvent({ email, kind: 'SIGNED_IN', detail: opts.via });
  return { ok: true, to: homeFor(await toolsFor(u.role, u.overrides)) };
}

export async function signOut() {
  const jar = await cookies();
  const id = (jar.get(COOKIE)?.value ?? '').split('.')[0];
  const me = await getMe();
  if (id) await db.session.deleteMany({ where: { id } });
  if (me) await logEvent({ email: me.email, kind: 'SIGNED_OUT', detail: 'Signed out' });
  jar.delete(COOKIE);
  jar.delete('rp_admin');
  jar.delete('rp_user');
}
