'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [['/aireviewer', 'AI Review'], ['/aireviewer/history', 'History'], ['/aireviewer/clients', 'Clients']] as const;

export default function AiNav() {
  const path = usePathname();
  return (
    <nav className="ai-tabs" aria-label="AI Reviewer">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} className={path === href ? 'on' : ''}>{label}</Link>
      ))}
    </nav>
  );
}
