import Link from 'next/link';
import '../admin/team/team.css';
import Shell from '../admin/Shell';
import { TOOLS, homeFor, isTool, requireMe, toolLabel } from '@/lib/access';
import { db } from '@/lib/db';
import RequestButton from './RequestButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'No access' };

/** Shown whenever someone opens a page their role does not include. */
export default async function NoAccess({ searchParams }: { searchParams: Promise<{ tool?: string }> }) {
  const me = await requireMe();
  const { tool } = await searchParams;
  const wanted = tool && isTool(tool) ? tool : null;
  const has = TOOLS.filter((t) => me.tools.includes(t.key)).map((t) => t.label);
  const admin = await db.user.findFirst({ where: { role: 'ADMIN', status: 'ACTIVE' }, orderBy: { createdAt: 'asc' }, select: { name: true, email: true } });
  const home = homeFor(me.tools);
  const label = wanted ? toolLabel(wanted) : 'this page';
  return (
    <Shell>
      <div className="gate">
        <div className="gate-card">
          <span className="eyebrow">{me.role === 'ADMIN' ? 'Admin' : me.role === 'PM' ? 'Project Manager' : me.role === 'DESIGNER' ? 'Designer' : 'Your account'}</span>
          <h1>You don&apos;t have access to {label}</h1>
          <p>
            {has.length ? `Your role gives you ${has.join(' and ')}.` : 'Your account has no tools yet.'} If you need {label} too, ask {admin ? admin.name || admin.email : 'an admin'}.
          </p>
          <div className="gate-btns">
            {home !== '/no-access' && <Link className="btn btn-primary" href={home}>Go to {toolLabel(TOOLS.find((t) => t.href === home)?.key ?? '')}</Link>}
            {wanted && <RequestButton tool={wanted} />}
          </div>
        </div>
      </div>
    </Shell>
  );
}
