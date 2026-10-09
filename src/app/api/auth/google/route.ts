import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { clientId, googleEnabled, redirectUri, to } from '@/lib/google';

export async function GET(req: Request) {
  if (!googleEnabled()) return to(req, '/login');
  const state = randomBytes(16).toString('base64url');
  (await cookies()).set('rp_oauth', state, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 600 });
  const q = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  const domain = process.env.ALLOWED_EMAIL_DOMAIN ?? 'reyaldesign.com';
  if (domain && !process.env.ALLOWED_EMAILS) q.set('hd', domain); // only a hint for the account picker; the server checks the email itself
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`, 303);
}
