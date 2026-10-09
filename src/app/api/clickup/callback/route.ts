import { cookies } from 'next/headers';
import { getMe } from '@/lib/access';
import { safeEq } from '@/lib/auth';
import { cuClientId, cuClientSecret, clickupEnabled, seal } from '@/lib/clickup';
import { db } from '@/lib/db';
import { to } from '@/lib/google';

export async function GET(req: Request) {
  const me = await getMe();
  if (!me) return to(req, '/login');
  if (!me.tools.includes('CLICKUP') || !clickupEnabled()) return to(req, '/clickup');
  const url = new URL(req.url);
  const jar = await cookies();
  const state = jar.get('rp_cu_oauth')?.value;
  jar.delete('rp_cu_oauth');
  const code = url.searchParams.get('code');
  // The state check stops someone else's ClickUp account from being attached to this login.
  if (!code || !state || !safeEq(state, url.searchParams.get('state') ?? '')) return to(req, '/clickup?error=Could not verify the ClickUp sign-in. Try Connect again.');

  const r = await fetch('https://api.clickup.com/api/v2/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: cuClientId(), client_secret: cuClientSecret(), code }),
  }).catch(() => null);
  const token = r?.ok ? ((await r.json()) as { access_token?: string }).access_token : null;
  if (!token) return to(req, '/clickup?error=ClickUp did not accept the sign-in. Try Connect again.');

  await db.clickupToken.upsert({ where: { userId: me.id }, create: { userId: me.id, token: seal(token) }, update: { token: seal(token), createdAt: new Date() } });
  return to(req, '/clickup');
}
