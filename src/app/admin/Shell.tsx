import './studio.css';
import './dashboard.css';
import Script from 'next/script';
import { homeFor, requireMe } from '@/lib/access';
import { aiEnabled } from '@/lib/ai';
import { overdueBadge } from '@/lib/clickupData';
import { db } from '@/lib/db';
import { logout } from './actions';
import Sidebar from './Sidebar';

/** The sidebar and frame shared by the designer area and the AI Reviewer. The caller checks sign-in first. */
export default async function Shell({ children }: { children: React.ReactNode }) {
  const me = await requireMe();
  const [open, pending] = await Promise.all([
    me.tools.includes('REQUESTS') ? db.comment.count({ where: { parentId: null, resolved: false, fromDesigner: false } }) : 0,
    me.tools.includes('TEAM') ? db.user.count({ where: { status: 'PENDING' } }) : 0,
  ]);
  return (
    <div className="studio">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Urbanist:wght@400;500;600;700;800&display=swap" />
      <Sidebar cuDue={me.tools.includes('CLICKUP') ? overdueBadge(me.id) : 0} name={me.name} email={me.email} open={open} pending={pending} tools={me.tools} home={homeFor(me.tools)} signOut={logout} ai={aiEnabled()} />
      <main className="main">{children}</main>
      <Script src="/spotlight.js" strategy="afterInteractive" />
    </div>
  );
}
