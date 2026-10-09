import { requireAdmin } from '@/lib/auth';
import Shell from './Shell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <Shell>{children}</Shell>;
}
