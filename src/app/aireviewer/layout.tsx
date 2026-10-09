import { requireAi } from '@/lib/ai';
import Shell from '../admin/Shell';
import './aireviewer.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'AI Reviewer' };

export default async function AiLayout({ children }: { children: React.ReactNode }) {
  await requireAi(); // signed in, and the tool is switched on (otherwise this whole section is a 404)
  return <Shell>{children}</Shell>;
}
