import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cookieOpts, safeEq, sign } from '@/lib/auth';

async function login(formData: FormData) {
  'use server';
  const ok =
    safeEq(String(formData.get('email') || '').trim().toLowerCase(), (process.env.ADMIN_EMAIL || '').toLowerCase()) &&
    safeEq(String(formData.get('password') || ''), process.env.ADMIN_PASSWORD || '');
  if (!ok) redirect('/login?error=1');
  (await cookies()).set('rp_admin', sign('admin'), cookieOpts);
  redirect('/admin');
}

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto mt-32 w-full max-w-sm px-4">
      <h1 className="mb-6 text-xl font-semibold">Reyal Proof</h1>
      <form action={login} className="card space-y-3">
        <input className="input" name="email" type="email" placeholder="Email" autoComplete="username" required />
        <input className="input" name="password" type="password" placeholder="Password" autoComplete="current-password" required />
        {error && <p className="text-sm text-red-400">Wrong email or password.</p>}
        <button className="btn w-full">Sign in</button>
      </form>
    </main>
  );
}
