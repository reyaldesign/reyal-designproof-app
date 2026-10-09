import Script from 'next/script';
import { redirect } from 'next/navigation';
import { getMe, homeFor } from '@/lib/access';
import { logout } from '../admin/actions';
import '../admin/team/team.css';
import Poll from './Poll';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Waiting for access' };

/** Where a new account lands until an admin gives it a role. It checks again every 15 seconds. */
export default async function Waiting() {
  const me = await getMe();
  if (!me) redirect('/login');
  if (me.status === 'ACTIVE') redirect(homeFor(me.tools));
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
          <h1 className="login-title">Almost there.</h1>
          <p className="login-intro">You&apos;re signed in as <strong>{me.email}</strong>. An admin needs to choose what you can use. We&apos;ve let them know. This page updates as soon as they do.</p>
          <div className="wait-status"><i />Waiting for access</div>
          <form action={logout} className="wait-out"><button>Use a different account · Sign out</button></form>
        </section>
        <footer className="login-foot">Reyal Design · Proofs, versions and client feedback in one place.</footer>
      </main>
      <Poll />
      <Script src="/spotlight.js" strategy="afterInteractive" />
    </div>
  );
}
