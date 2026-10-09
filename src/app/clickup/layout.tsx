import { Suspense } from 'react';
import { requireTool } from '@/lib/access';
import Shell from '../admin/Shell';
import Nav from './Nav';
import './clickup.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tasks' };

export default async function ClickupLayout({ children }: { children: React.ReactNode }) {
  const me = await requireTool('CLICKUP');
  return (
    <Shell>
      <div className="cu-frame">
        <Suspense fallback={<nav className="cu-nav"><div className="cu-nh"><div className="cu-nt"><span>ClickUp</span><span className="cu-sync">Loading lists…</span></div></div></nav>}>
          <Nav userId={me.id} userName={me.name} />
        </Suspense>
        <div className="cu-main">{children}</div>
      </div>
    </Shell>
  );
}
