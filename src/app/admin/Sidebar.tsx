'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const grid = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></svg>;
const inbox = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 13.5 6 5.5h12l2.5 8" /><path d="M3.5 13.5v5a1 1 0 0 0 1 1h15a1 1 0 0 0 1-1v-5h-5l-1.5 2.5h-4L8.5 13.5z" /></svg>;
const chevron = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>;
const spark = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.5l-1.9-5.7L4.5 11l5.6-1.9z" /><path d="M19 3.5v3M17.5 5h3" /></svg>;
const out = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4.5H5.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H9" /><path d="m16 8 4 4-4 4M20 12H9" /></svg>;

export default function Sidebar({ name, email, open, signOut, ai }: { name: string; email: string; open: number; signOut: () => Promise<void>; ai: boolean }) {
  const path = usePathname();
  const onRequests = path.startsWith('/admin/requests');
  const onAi = path.startsWith('/aireviewer');

  useEffect(() => {
    try { document.documentElement.classList.toggle('side-collapsed', localStorage.getItem('rp:side') === 'collapsed'); } catch { /* storage unavailable */ }
  }, []);
  const toggle = () => {
    const c = document.documentElement.classList.toggle('side-collapsed');
    try { localStorage.setItem('rp:side', c ? 'collapsed' : 'open'); } catch { /* storage unavailable */ }
  };

  return (
    <aside className="side" data-spotlight>
      <div className="side-top">
        <Link href="/admin" className="brand" aria-label="Reyal Proof home">
          <span className="brand-mark">R</span>
          <span className="brand-word">Reyal <b>Proof</b></span>
        </Link>
      </div>
      <nav className="side-nav" aria-label="Main">
        <Link href="/admin" className={`side-item ${!onRequests && !onAi ? 'on' : ''}`} title="Clients">{grid}<span className="side-label">Clients</span></Link>
        <Link href="/admin/requests" className={`side-item ${onRequests ? 'on' : ''}`} title="Requests">
          {inbox}<span className="side-label">Requests</span>
          {open > 0 && <span className="side-badge">{open}</span>}
        </Link>
        {ai && <Link href="/aireviewer" className={`side-item ${onAi ? 'on' : ''}`} title="AI Reviewer">{spark}<span className="side-label">AI Reviewer</span></Link>}
      </nav>
      <div className="side-bottom">
        <div className="side-user">
          <span className="avatar">{name.charAt(0)}</span>
          <span className="side-label"><b>{name}</b><small>{email}</small></span>
        </div>
        <form action={signOut}>
          <button className="side-item" title="Sign out">{out}<span className="side-label">Sign out</span></button>
        </form>
        <button className="side-toggle" onClick={toggle} aria-label="Collapse sidebar">{chevron}</button>
      </div>
    </aside>
  );
}
