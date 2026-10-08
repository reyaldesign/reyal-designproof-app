import { cookies } from 'next/headers';
import { cookieOpts, rememberUser, safeEq, sign } from '@/lib/auth';
import { clientId, clientSecret, googleEnabled, isAllowed, redirectUri, to } from '@/lib/google';

export async function GET(req: Request) {
  if (!googleEnabled()) return to(req, '/login');
  const url = new URL(req.url);
  const jar = await cookies();
  const state = jar.get('rp_oauth')?.value;
  jar.delete('rp_oauth');
  const code = url.searchParams.get('code');
  if (!code || !state || !safeEq(state, url.searchParams.get('state') ?? '')) return to(req, '/login?error=google');

  // The id_token comes straight from Google over TLS in exchange for our one-time code, so it is trusted without a signature check (OIDC core, 3.1.3.7).
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(req),
      grant_type: 'authorization_code',
    }),
  }).catch(() => null);
  const idToken = r?.ok ? ((await r.json()) as { id_token?: string }).id_token : null;
  if (!idToken) return to(req, '/login?error=google');

  const claims = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString()) as {
    email?: string; email_verified?: boolean; aud?: string;
  };
  if (claims.aud !== clientId() || !claims.email || claims.email_verified !== true) return to(req, '/login?error=google');
  if (!isAllowed(claims.email)) return to(req, '/login?error=denied');

  jar.set('rp_admin', sign('admin'), cookieOpts);
  await rememberUser(claims.email);
  return to(req, '/admin');
}
