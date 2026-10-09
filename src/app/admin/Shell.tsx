import './studio.css';
import './dashboard.css';
import Script from 'next/script';
import { currentUser } from '@/lib/auth';
import { aiEnabled } from '@/lib/ai';
import { db } from '@/lib/db';
import { logout } from './actions';
import Sidebar from './Sidebar';

/** The sidebar and frame shared by the designer area and the AI Reviewer. The caller checks sign-in first. */
export default async function Shell({ children }: { children: React.ReactNode }) {
  const [user, open] = await Promise.all([
    currentUser(),
    db.comment.count({ where: { parentId: null, resolved: false, fromDesigner: false } }),
  ]);
  return (
    <div className="studio">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Urbanist:wght@400;500;600;700;800&display=swap" />
      <Sidebar name={user.name} email={user.email} open={open} signOut={logout} ai={aiEnabled()} />
      <main className="main">{children}</main>
      <Script src="/spotlight.js" strategy="afterInteractive" />
    </div>
  );
}
