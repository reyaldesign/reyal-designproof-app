import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { getMe } from '@/lib/access';
import { cuClientId, clickupEnabled, clickupRedirect } from '@/lib/clickup';
import { base, to } from '@/lib/google';

/** Sends the signed-in person to ClickUp to approve access. */
export async function GET(req: Request) {
  const me = await getMe();
  if (!me) return to(req, '/login');
  if (!me.tools.includes('CLICKUP') || !clickupEnabled()) return to(req, '/clickup');
  const state = randomBytes(16).toString('base64url');
  (await cookies()).set('rp_cu_oauth', state, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 600 });
  const q = new URLSearchParams({ client_id: cuClientId(), redirect_uri: clickupRedirect(base(req)), state });
  return Response.redirect(`https://app.clickup.com/api?${q}`, 303);
}
