import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { mainwpConfigured } from '@/lib/mainwp';
import PluginsApp, { type SiteRow } from './PluginsApp';

export default async function PluginsPage() {
  if (!mainwpConfigured()) notFound(); // plugin lists come from MainWP, so without it there is nothing to show
  const sites = await db.website.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, clientName: true, url: true, status: true, server: true, pluginsAt: true, plugins: { select: { name: true, version: true, active: true, updateVersion: true }, orderBy: { name: 'asc' } } },
  });
  const rows: SiteRow[] = sites.map((s) => ({
    id: s.id, name: s.clientName, url: s.url, status: s.status, server: s.server, readAt: s.pluginsAt?.toISOString() ?? null,
    plugins: s.plugins.map((p) => ({ name: p.name, version: p.version, active: p.active, update: p.updateVersion })),
  }));
  return <PluginsApp rows={rows} />;
}
