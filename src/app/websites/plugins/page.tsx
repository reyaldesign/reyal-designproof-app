import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { mainwpConfigured } from '@/lib/mainwp';
import PluginsApp, { type Install } from './PluginsApp';

export default async function PluginsPage() {
  if (!mainwpConfigured()) notFound(); // plugin lists come from MainWP, so without it there is nothing to show
  const rows = await db.websitePlugin.findMany({ include: { website: { select: { id: true, clientName: true, status: true, pluginsAt: true } } } });
  const installs: Install[] = rows.map((p) => ({
    slug: p.slug, name: p.name, version: p.version, active: p.active, update: p.updateVersion,
    siteId: p.website.id, site: p.website.clientName, siteStatus: p.website.status,
  }));
  const readAt = rows.reduce<Date | null>((latest, p) => (p.website.pluginsAt && (!latest || p.website.pluginsAt > latest) ? p.website.pluginsAt : latest), null);
  return <PluginsApp installs={installs} readAt={readAt?.toISOString() ?? null} />;
}
