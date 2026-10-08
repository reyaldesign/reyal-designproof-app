import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not set');
  return s;
};
export const sign = (v: string) => createHmac('sha256', secret()).update(v).digest('base64url');
export const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
};

export async function isAdmin() {
  const c = (await cookies()).get('rp_admin')?.value;
  return !!c && safeEq(c, sign('admin'));
}
export async function requireAdmin() {
  if (!(await isAdmin())) redirect('/login');
}

/** Remembers who signed in so the sidebar can show them. Display only, never used for access. */
export async function rememberUser(email: string) {
  (await cookies()).set('rp_user', email, { ...cookieOpts, httpOnly: false });
}
export async function currentUser() {
  const email = (await cookies()).get('rp_user')?.value ?? process.env.ADMIN_EMAIL ?? '';
  const first = email.split('@')[0].split(/[._-]/)[0] || 'Designer';
  return { email, name: first.charAt(0).toUpperCase() + first.slice(1) };
}
