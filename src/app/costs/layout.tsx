import { requireTool } from '@/lib/access';
import Shell from '../admin/Shell';
import './costs.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Stack costs' };

export default async function CostsLayout({ children }: { children: React.ReactNode }) {
  await requireTool('COSTS');
  return <Shell>{children}</Shell>;
}
