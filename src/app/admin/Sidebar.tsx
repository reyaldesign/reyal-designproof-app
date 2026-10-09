'use client';

import Brand from '@/components/Brand';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const grid = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></svg>;
const inbox = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 13.5 6 5.5h12l2.5 8" /><path d="M3.5 13.5v5a1 1 0 0 0 1 1h15a1 1 0 0 0 1-1v-5h-5l-1.5 2.5h-4L8.5 13.5z" /></svg>;
const chevron = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>;
const spark = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.5l-1.9-5.7L4.5 11l5.6-1.9z" /><path d="M19 3.5v3M17.5 5h3" /></svg>;
const team = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c.4-3.2 2.8-5 5.5-5s5.1 1.8 5.5 5" /><path d="M16 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.3c1.8.6 3 2.2 3.2 4.7" /></svg>;
const board = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="10" rx="1.5" /><rect x="16.5" y="4" width="4" height="13" rx="1.5" /></svg>;
const out = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4.5H5.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H9" /><path d="m16 8 4 4-4 4M20 12H9" /></svg>;

export default function Sidebar({ name, email, open, pending, cuDue, tools, home, signOut, ai }: { cuDue: number; name: string; email: string; open: number; pending: number; tools: string[]; home: string; signOut: () => Promise<void>; ai: boolean }) {
  const path = usePathname();
  const [menu, setMenu] = useState(false); // the phone menu
  const onRequests = path.startsWith('/admin/requests');
  const onAi = path.startsWith('/aireviewer');
  const onTeam = path.startsWith('/admin/team');
  const onClickup = path.startsWith('/clickup');
  const has = (t: string) => tools.includes(t);
  const aiHref = has('AI_REVIEW') ? '/aireviewer' : '/aireviewer/clients';

  useEffect(() => setMenu(false), [path]); // close the phone menu after choosing a page
  useEffect(() => {
    try { document.documentElement.classList.toggle('side-collapsed', localStorage.getItem('rp:side') === 'collapsed'); } catch { /* storage unavailable */ }
  }, []);
  const toggle = () => {
    const c = document.documentElement.classList.toggle('side-collapsed');
    try { localStorage.setItem('rp:side', c ? 'collapsed' : 'open'); } catch { /* storage unavailable */ }
  };

  return (
    <aside className={`side ${menu ? 'menu-open' : ''}`} data-spotlight>
      <div className="side-top">
        <Link href={home} className="brand" aria-label="Reyal Design Studio home">
          <Brand />
        </Link>
        <button className="side-burger" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">{menu ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
        </button>
      </div>
      <nav className="side-nav" aria-label="Main">
        {has('PROOFS') && <Link href="/admin" className={`side-item ${!onRequests && !onAi && !onTeam && !onClickup ? 'on' : ''}`} title="Clients">{grid}<span className="side-label">Clients</span></Link>}
        {has('REQUESTS') && (
          <Link href="/admin/requests" className={`side-item ${onRequests ? 'on' : ''}`} title="Requests">
            {inbox}<span className="side-label">Requests</span>
            {open > 0 && <span className="side-badge">{open}</span>}
          </Link>
        )}
        {ai && (has('AI_REVIEW') || has('AI_CRITERIA')) && <Link href={aiHref} className={`side-item ${onAi ? 'on' : ''}`} title="AI Reviewer">{spark}<span className="side-label">AI Reviewer</span></Link>}
        {has('CLICKUP') && <Link href="/clickup" className={`side-item ${onClickup ? 'on' : ''}`} title="Tasks">{board}<span className="side-label">Tasks</span>{cuDue > 0 && <span className="side-badge side-badge-late" title="Overdue tasks">{cuDue}</span>}</Link>}
        {has('TEAM') && (
          <>
            <div className="side-section side-label">Admin</div>
            <Link href="/admin/team" className={`side-item ${onTeam ? 'on' : ''}`} title="Team & access">
              {team}<span className="side-label">Team & access</span>
              {pending > 0 && <span className="side-badge side-badge-warn">{pending}</span>}
            </Link>
          </>
        )}
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
