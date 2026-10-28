import { db } from '@/lib/db';
import { loadStats, loadStrips } from '@/lib/websiteMonitor';
import { FIELDS, isMonitored, pct } from '@/lib/websitesShared';
import WebsitesApp, { type Row } from './WebsitesApp';

export default async function WebsitesPage() {
  const [sites, stats, strips] = await Promise.all([db.website.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }), loadStats(), loadStrips()]);
  const days = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 864e5).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  const rows: Row[] = sites.map((s) => {
    const st = stats.get(s.id);
    const monitored = isMonitored(s);
    return {
      id: s.id, clientName: s.clientName, url: s.url, status: s.status, server: s.server, captcha: s.captcha, backup: s.backup,
      desktopStatus: s.desktopStatus, mobileStatus: s.mobileStatus, seo: s.seo,
      formSubmission: s.formSubmission, emailUsed: s.emailUsed,
      state: !monitored ? 'off' : !st?.last ? 'none' : st.last.ok ? 'up' : 'down',
      error: st?.last?.error ?? null, lastAt: st?.last?.at.toISOString() ?? null,
      up1: pct(st?.d1), up7: pct(st?.d7), up30: pct(st?.d30),
      strip: strips.get(s.id) ?? Array<null>(30).fill(null),
    };
  });
  // Suggestions for each dropdown field: the usual values plus whatever is already in the list.
  const options: Record<string, string[]> = {};
  for (const f of FIELDS) if ('list' in f) options[f.key] = [...new Set([...f.list, ...sites.map((s) => (s as unknown as Record<string, string>)[f.key]).filter(Boolean)])];
  return <WebsitesApp rows={rows} days={days} options={options} />;
}
