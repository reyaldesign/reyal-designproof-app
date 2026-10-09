'use server';

import { revalidatePath } from 'next/cache';
import { ROLE_LABEL, isRole, isTool, logEvent, requireTool, toolLabel, type Role } from '@/lib/access';
import { db } from '@/lib/db';
import { isAllowed } from '@/lib/google';

type Result = { error?: string };
const done = (): Result => { revalidatePath('/admin/team'); return {}; };
const roleName = (r: string | null) => (r && isRole(r) ? ROLE_LABEL[r] : 'no role');
const who = (u: { name: string; email: string }) => u.name || u.email;

/** The team always needs one active admin who can open this page. */
async function lastAdminGuard(userId: string) {
  const u = await db.user.findUnique({ where: { id: userId } });
  if (u?.role !== 'ADMIN' || u.status !== 'ACTIVE') return false;
  return (await db.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } })) <= 1;
}
const note = (actor: string, detail: string) => logEvent({ email: actor, kind: 'ACCESS_CHANGED', detail, actor });

export async function approveUser(id: string, role: string): Promise<Result> {
  const me = await requireTool('TEAM');
  if (!isRole(role)) return { error: 'Choose a role.' };
  const u = await db.user.update({ where: { id }, data: { role, status: 'ACTIVE' } });
  await note(me.email, `Gave ${who(u)} access as ${roleName(role)}`);
  return done();
}

export async function denyUser(id: string): Promise<Result> {
  const me = await requireTool('TEAM');
  const u = await db.user.update({ where: { id }, data: { status: 'DENIED', role: null } });
  await db.session.deleteMany({ where: { userId: id } });
  await note(me.email, `Denied access to ${who(u)}`);
  return done();
}

export async function setRole(id: string, role: string): Promise<Result> {
  const me = await requireTool('TEAM');
  if (!isRole(role)) return { error: 'Choose a role.' };
  if (role !== 'ADMIN' && (await lastAdminGuard(id))) return { error: 'This is the last admin. Make someone else an admin first.' };
  // A new role starts clean: the person's own grants and removals are cleared.
  const [u] = await db.$transaction([
    db.user.update({ where: { id }, data: { role, status: 'ACTIVE' } }),
    db.userToolOverride.deleteMany({ where: { userId: id } }),
  ]);
  await note(me.email, `Changed ${who(u)} to ${roleName(role)}`);
  return done();
}

export async function setToolForUser(id: string, tool: string, on: boolean): Promise<Result> {
  const me = await requireTool('TEAM');
  if (!isTool(tool)) return { error: 'Unknown tool.' };
  const u = await db.user.findUnique({ where: { id } });
  if (!u) return { error: 'Person not found.' };
  if (u.role === 'ADMIN' && tool === 'TEAM') return { error: 'Admins always keep Team & access.' };
  const fromRole = !!(await db.rolePermission.findUnique({ where: { role_tool: { role: u.role ?? '', tool } } }));
  const where = { userId_tool: { userId: id, tool } };
  if (on === fromRole) await db.userToolOverride.deleteMany({ where: { userId: id, tool } }); // back to what the role says
  else await db.userToolOverride.upsert({ where, update: { granted: on }, create: { userId: id, tool, granted: on } });
  await note(me.email, `${on ? 'Gave' : 'Removed'} ${who(u)} ${toolLabel(tool)}`);
  return done();
}

export async function setRoleTool(role: string, tool: string, on: boolean): Promise<Result> {
  const me = await requireTool('TEAM');
  if (!isRole(role) || !isTool(tool)) return { error: 'Unknown role or tool.' };
  if (role === 'ADMIN' && tool === 'TEAM') return { error: 'Admins always keep Team & access.' };
  if (on) await db.rolePermission.upsert({ where: { role_tool: { role, tool } }, update: {}, create: { role, tool } });
  else await db.rolePermission.deleteMany({ where: { role, tool } });
  await note(me.email, `${on ? 'Turned on' : 'Turned off'} ${toolLabel(tool)} for ${ROLE_LABEL[role as Role]}`);
  return done();
}

export async function suspendUser(id: string): Promise<Result> {
  const me = await requireTool('TEAM');
  if (id === me.id) return { error: "You can't suspend yourself." };
  if (await lastAdminGuard(id)) return { error: 'This is the last admin.' };
  const u = await db.user.update({ where: { id }, data: { status: 'SUSPENDED' } });
  await db.session.deleteMany({ where: { userId: id } }); // signed out right away
  await note(me.email, `Suspended ${who(u)}`);
  return done();
}

export async function reactivateUser(id: string): Promise<Result> {
  const me = await requireTool('TEAM');
  const u = await db.user.update({ where: { id }, data: { status: 'ACTIVE' } });
  await note(me.email, `Reactivated ${who(u)}`);
  return done();
}

export async function signOutEverywhere(id: string): Promise<Result> {
  const me = await requireTool('TEAM');
  const u = await db.user.findUnique({ where: { id } });
  if (!u) return { error: 'Person not found.' };
  await db.session.deleteMany({ where: { userId: id } });
  await note(me.email, `Signed ${who(u)} out of all devices`);
  return done();
}

/** Gives someone a role before their first sign-in. */
export async function preAssign(email: string, role: string): Promise<Result> {
  const me = await requireTool('TEAM');
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { error: 'Enter a valid email address.' };
  if (!isRole(role)) return { error: 'Choose a role.' };
  if (!isAllowed(e)) return { error: 'That account is not allowed to sign in. Only the company domain and listed emails can.' };
  if (await db.user.findUnique({ where: { email: e } })) return { error: 'That person is already on the list.' };
  await db.user.create({ data: { email: e, role, status: 'ACTIVE' } });
  await note(me.email, `Pre-assigned ${e} as ${roleName(role)}`);
  return done();
}
