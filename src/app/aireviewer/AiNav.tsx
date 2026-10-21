'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext } from 'react';
import AiStatus from './AiStatus';
import { LangToggle, useLang } from './Lang';

const Tools = createContext({ review: true, criteria: true });
export const AiToolsProvider = ({ review, criteria, children }: { review: boolean; criteria: boolean; children: React.ReactNode }) => (
  <Tools.Provider value={{ review, criteria }}>{children}</Tools.Provider>
);

export default function AiNav() {
  const path = usePathname();
  const { t } = useLang();
  const { review, criteria } = useContext(Tools);
  const tabs = [
    ...(review ? [['/aireviewer', 'AI Review'], ['/aireviewer/history', 'History']] : []),
    ...(criteria ? [['/aireviewer/clients', 'Clients']] : []),
  ];
  return (
    <div className="ai-headright">
      <LangToggle />
      <AiStatus />
      <nav className="ai-tabs" aria-label={t('AI Reviewer')}>
        {tabs.map(([href, label]) => (
          <Link key={href} href={href} className={path === href ? 'on' : ''}>{t(label)}</Link>
        ))}
      </nav>
    </div>
  );
}
