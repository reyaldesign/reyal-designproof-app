import { cookies } from 'next/headers';
import Script from 'next/script';
import { redirect } from 'next/navigation';
import { cookieOpts, rememberUser, safeEq, sign } from '@/lib/auth';
import { googleEnabled } from '@/lib/google';

async function login(formData: FormData) {
  'use server';
  const ok =
    safeEq(String(formData.get('email') || '').trim().toLowerCase(), (process.env.ADMIN_EMAIL || '').toLowerCase()) &&
    safeEq(String(formData.get('password') || ''), process.env.ADMIN_PASSWORD || '');
  if (!ok) redirect('/login?error=1');
  (await cookies()).set('rp_admin', sign('admin'), cookieOpts);
  await rememberUser(String(formData.get('email') || '').trim().toLowerCase());
  redirect('/admin');
}

const domain = () => process.env.ALLOWED_EMAIL_DOMAIN ?? 'reyaldesign.com';
const MESSAGES: Record<string, () => string> = {
  '1': () => 'Wrong email or password.',
  google: () => 'Google sign-in did not complete. Please try again.',
  denied: () => `Only @${domain()} Google accounts can sign in.`,
};

const G = (
  <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const google = googleEnabled();
  const msg = error ? (MESSAGES[error] ?? MESSAGES['1'])() : '';
  return (
    <div className="login">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Urbanist:wght@400;500;600;700&display=swap" />
      <main className="login-wrap">
        <header className="login-top">
          <span className="brand"><span className="brand-mark">R</span><span className="brand-word">Reyal <b>Proof</b></span></span>
          <span className="login-tag">Design proofing</span>
        </header>

        <section data-spotlight className="login-card">
          <h1 className="login-title">Let&apos;s proof.</h1>
          <p className="login-intro">
            {google
              ? <>Sign in with your <strong>@{domain()}</strong> Google account to manage clients, proofs and feedback.</>
              : 'Sign in to manage clients, proofs and feedback.'}
          </p>
          {msg && <p className="login-err">{msg}</p>}
          {google && <a className="btn-google" href="/api/auth/google">{G}<span>Continue with Google</span></a>}
          {!google && <p className="login-notice">Google sign-in is not set up yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.</p>}

          <details open={!google || error === '1'}>
            <summary>{google ? 'Use email and password instead' : 'Email and password'}</summary>
            <form action={login} className="grid gap-3">
              <input className="input" name="email" type="email" placeholder="Email" autoComplete="username" required />
              <input className="input" name="password" type="password" placeholder="Password" autoComplete="current-password" required />
              <button className="btn-login">Sign in</button>
            </form>
          </details>
        </section>

        <footer className="login-foot">Reyal Design · Proofs, versions and client feedback in one place.</footer>
      </main>
      <Script src="/spotlight.js" strategy="afterInteractive" />
    </div>
  );
}
