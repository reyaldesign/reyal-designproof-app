import { requireTool } from '@/lib/access';
import Shell from '../admin/Shell';
import './websites.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Websites' };

export default async function WebsitesLayout({ children }: { children: React.ReactNode }) {
  await requireTool('WEBSITES');
  return <Shell>{children}</Shell>;
}
