import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { db } from './db';

export const cuClientId = () => (process.env.CLICKUP_CLIENT_ID ?? '').trim();
export const cuClientSecret = () => (process.env.CLICKUP_CLIENT_SECRET ?? '').trim();
export const clickupEnabled = () => !!(cuClientId() && cuClientSecret());
export const clickupRedirect = (base: string) => `${base}/api/clickup/callback`;

// Tokens are stored encrypted. Changing SESSION_SECRET makes them unreadable, so people simply connect again.
const key = () => {
  if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is not set');
  return createHash('sha256').update(`clickup:${process.env.SESSION_SECRET}`).digest();
};
export function seal(text: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64url')).join('.');
}
function unseal(s: string) {
  const [iv, tag, enc] = s.split('.').map((p) => Buffer.from(p, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

export class ClickupError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// Local testing only: a personal ClickUp token (pk_...) in .env stands in for everyone's OAuth connection. Ignored in production.
const devToken = () => (process.env.NODE_ENV === 'production' ? '' : (process.env.CLICKUP_DEV_TOKEN ?? '').trim());

/** The tool can run: either the OAuth app is configured, or a local dev token is set. */
export const clickupAvailable = () => clickupEnabled() || !!devToken();

export const isConnected = async (userId: string) => !!devToken() || !!(await db.clickupToken.findUnique({ where: { userId }, select: { userId: true } }));

/** One call to the ClickUp API as this person. A rejected token is deleted so the page falls back to "Connect". */
export async function cu<T>(userId: string, path: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const dev = devToken();
  let token = dev;
  if (!dev) {
    const row = await db.clickupToken.findUnique({ where: { userId } });
    if (!row) throw new ClickupError(401, 'Connect your ClickUp account first.');
    try { token = unseal(row.token); } catch {
      await db.clickupToken.delete({ where: { userId } }).catch(() => {});
      throw new ClickupError(401, 'Your ClickUp connection needs to be set up again.');
    }
  }
  const r = await fetch(`https://api.clickup.com/api/v2${path}`, {
    method: init.method ?? 'GET',
    // ClickUp wants "Bearer" for OAuth tokens and the bare token for personal ones.
    headers: { Authorization: dev ? token : `Bearer ${token}`, ...(init.form ? {} : { 'Content-Type': 'application/json' }) }, // a file upload sets its own multipart type
    body: init.form ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
    cache: 'no-store',
    signal: AbortSignal.timeout(init.form ? 90_000 : 15_000), // a hung ClickUp must not hang the page; uploads get longer
  }).catch(() => null);
  if (!r) throw new ClickupError(502, 'Could not reach ClickUp. Try again in a moment.');
  if (r.status === 401) {
    if (dev) throw new ClickupError(401, 'ClickUp rejected CLICKUP_DEV_TOKEN. Check the token in .env.');
    await db.clickupToken.delete({ where: { userId } }).catch(() => {});
    throw new ClickupError(401, 'Your ClickUp connection expired. Connect again.');
  }
  if (r.status === 429) throw new ClickupError(429, 'ClickUp is limiting requests (100 a minute). Wait a minute and try again.');
  if (!r.ok) throw new ClickupError(r.status, `ClickUp refused that (${r.status}).`);
  return (await r.json()) as T;
}

export const errorText = (e: unknown) => (e instanceof ClickupError ? e.message : 'Something went wrong talking to ClickUp.');

// The parts of ClickUp's responses this tool reads.
export type CuUser = { id: number; username: string; initials?: string; color?: string; profilePicture?: string | null };
export type CuStatus = { status: string; color: string; orderindex: number; type: string };
export type CuOption = { id: string; name: string; color: string; orderindex: number };
export type CuField = { id: string; name: string; type?: string; value?: unknown; type_config?: { options?: CuOption[] } };
export type CuTask = {
  id: string; name: string; text_content?: string; description?: string; url: string;
  status: { status: string; color: string; type?: string };
  assignees: CuUser[];
  priority: { id?: string; priority: string; color: string } | null;
  due_date: string | null;
  date_closed?: string | null;
  tags: { name: string; tag_bg: string; tag_fg: string }[];
  list: { id: string; name: string }; space: { id: string }; folder?: { id: string; name: string };
  checklists?: { resolved: number; unresolved: number }[];
  attachments?: { id: string; title: string; url: string; extension?: string; thumbnail_large?: string | null }[];
  custom_fields?: CuField[];
};
export type CuComment = { id: string; comment_text: string; user: CuUser; date: string };
