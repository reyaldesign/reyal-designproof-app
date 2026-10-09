'use server';

import { adminEmails, isTool, logEvent, requireMe, toolLabel } from '@/lib/access';
import { db } from '@/lib/db';
import { notify } from '@/lib/mail';

/** Tells the admins this person wants a tool. One request per tool per hour, so the button cannot flood anyone. */
export async function requestAccess(tool: string): Promise<{ ok: boolean }> {
  const me = await requireMe();
  if (!isTool(tool)) return { ok: false };
  const detail = `Asked for ${toolLabel(tool)}`;
  const recent = await db.signInEvent.findFirst({ where: { email: me.email, kind: 'ACCESS_REQUESTED', detail, at: { gt: new Date(Date.now() - 3600_000) } } });
  if (!recent) {
    await logEvent({ email: me.email, kind: 'ACCESS_REQUESTED', detail });
    await notify(`${me.name} asked for ${toolLabel(tool)}`, `${me.email} asked for access to ${toolLabel(tool)}.\n\nChange it on the Team & access page: ${process.env.APP_URL || ''}/admin/team`, await adminEmails());
  }
  return { ok: true };
}
