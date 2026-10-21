import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { aiEnabled } from '@/lib/ai';
import { LANG_COOKIE, isLang } from '@/lib/aiI18n';
import { requireMe } from '@/lib/access';
import Shell from '../admin/Shell';
import { AiToolsProvider } from './AiNav';
import { LangProvider } from './Lang';
import './aireviewer.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'AI Reviewer' };

export default async function AiLayout({ children }: { children: React.ReactNode }) {
  if (!aiEnabled()) notFound(); // switched off: the whole section is a 404
  const me = await requireMe();
  const review = me.tools.includes('AI_REVIEW'), criteria = me.tools.includes('AI_CRITERIA');
  if (!review && !criteria) redirect('/no-access?tool=AI_REVIEW'); // each page checks its own tool
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  return <Shell><LangProvider initial={isLang(saved) ? saved : 'en'}><AiToolsProvider review={review} criteria={criteria}>{children}</AiToolsProvider></LangProvider></Shell>;
}
