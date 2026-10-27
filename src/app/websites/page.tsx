import { db } from '@/lib/db';
import { loadStats } from '@/lib/websiteMonitor';
import { FIELDS, isMonitored, pct } from '@/lib/websitesShared';
import WebsitesApp, { type Row } from './WebsitesApp';

export default async function WebsitesPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const [sites, stats] = await Promise.all([db.website.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }), loadStats()]);
  const rows: Row[] = sites.map((s) => {
    const st = stats.get(s.id);
    const monitored = isMonitored(s);
    return {
      id: s.id, clientName: s.clientName, url: s.url, status: s.status, server: s.server, captcha: s.captcha, backup: s.backup, forwardLinks: s.forwardLinks,
      backupTime: s.backupTime, maintenanceCheck: s.maintenanceCheck, desktopStatus: s.desktopStatus, mobileStatus: s.mobileStatus, seo: s.seo,
      formSubmission: s.formSubmission, emailUsed: s.emailUsed,
      state: !monitored ? 'off' : !st?.last ? 'none' : st.last.ok ? 'up' : 'down',
      ms: st?.last?.ms ?? null, error: st?.last?.error ?? null, lastAt: st?.last?.at.toISOString() ?? null,
      up1: pct(st?.d1), up7: pct(st?.d7), up30: pct(st?.d30),
    };
  });
  // Suggestions for each dropdown field: the usual values plus whatever is already in the list.
  const options: Record<string, string[]> = {};
  for (const f of FIELDS) if ('list' in f) options[f.key] = [...new Set([...f.list, ...sites.map((s) => (s as unknown as Record<string, string>)[f.key]).filter(Boolean)])];
  return <WebsitesApp rows={rows} options={options} editId={edit} />;
}
