'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext } from 'react';
import AiStatus from './AiStatus';

const Tools = createContext({ review: true, criteria: true });
export const AiToolsProvider = ({ review, criteria, children }: { review: boolean; criteria: boolean; children: React.ReactNode }) => (
  <Tools.Provider value={{ review, criteria }}>{children}</Tools.Provider>
);

export default function AiNav() {
  const path = usePathname();
  const { review, criteria } = useContext(Tools);
  const tabs = [
    ...(review ? [['/aireviewer', 'AI Review'], ['/aireviewer/history', 'History']] : []),
    ...(criteria ? [['/aireviewer/clients', 'Clients']] : []),
  ];
  return (
    <div className="ai-headright">
      <AiStatus />
      <nav className="ai-tabs" aria-label="AI Reviewer">
        {tabs.map(([href, label]) => (
          <Link key={href} href={href} className={path === href ? 'on' : ''}>{label}</Link>
        ))}
      </nav>
    </div>
  );
}
