'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** The two views of the Websites tool: the sites, and the plugins on them. */
export default function WsTabs() {
  const path = usePathname();
  return (
    <nav className="ws-tabs" aria-label="Websites">
      <Link href="/websites" className={path === '/websites' ? 'on' : ''}>Sites</Link>
      <Link href="/websites/plugins" className={path === '/websites/plugins' ? 'on' : ''}>Plugins</Link>
    </nav>
  );
}
