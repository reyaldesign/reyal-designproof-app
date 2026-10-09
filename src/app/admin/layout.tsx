import { requireMe } from '@/lib/access';
import Shell from './Shell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireMe(); // each page checks its own tool
  return <Shell>{children}</Shell>;
}
