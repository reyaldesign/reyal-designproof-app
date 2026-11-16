import { db } from './db';
import { siteKey } from './websitesShared';

// Reads each website's plugin list from the studio's MainWP dashboard. It only ever reads.
// MAINWP_URL is the dashboard's address and MAINWP_KEY is an API key made under MainWP Dashboard, API Access.
// The dashboard answers on /?rest_route=, which works whether or not pretty links are on.

const TIMEOUT_MS = 30_000;
const PARALLEL = 4;
const EVERY_HOURS = 24;

export const mainwpConfigured = () => !!(process.env.MAINWP_URL && process.env.MAINWP_KEY);

async function get<T>(path: string): Promise<T> {
  const base = (process.env.MAINWP_URL ?? '').replace(/\/+$/, '');
  const res = await fetch(`${base}/?rest_route=/mainwp/v2${path}`, {
    headers: { authorization: `Bearer ${process.env.MAINWP_KEY}`, accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`MainWP answered ${res.status}`);
  return (await res.json()) as T;
}

type MainwpSite = { id: string | number; url: string };
type MainwpPlugin = { slug: string; name: string; version: string | null; active: boolean; update_version: string | null };

/** Every site MainWP manages, a page at a time. */
async function mainwpSites(): Promise<MainwpSite[]> {
  const out: MainwpSite[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data } = await get<{ data: MainwpSite[] }>(`/sites/basic&per_page=100&page=${page}`);
    out.push(...data);
    if (data.length < 100) break;
  }
  return out;
}

export type SyncResult = { synced: number; notInMainwp: number; failed: number };

const g = globalThis as unknown as { __pluginSync?: Promise<SyncResult>; __pluginSchedule?: boolean };

/** Matches MainWP's sites to ours by web address, then stores each matched site's plugins. A second call while one is running shares it. */
export function syncPlugins(): Promise<SyncResult> {
  return (g.__pluginSync ??= run().finally(() => { g.__pluginSync = undefined; }));
}

async function run(): Promise<SyncResult> {
  const [theirs, ours] = await Promise.all([mainwpSites(), db.website.findMany({ where: { url: { not: '' } }, select: { id: true, url: true } })]);
  const byKey = new Map(theirs.map((s) => [siteKey(s.url), s.id]));
  const queue = ours.flatMap((w) => { const id = byKey.get(siteKey(w.url)); return id == null ? [] : [{ websiteId: w.id, mainwpId: id }]; });
  const result: SyncResult = { synced: 0, notInMainwp: ours.length - queue.length, failed: 0 };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
    for (let q = queue.shift(); q; q = queue.shift()) {
      try {
        const { data } = await get<{ data: MainwpPlugin[] }>(`/sites/${q.mainwpId}/plugins&per_page=500`);
        await db.$transaction([
          db.websitePlugin.deleteMany({ where: { websiteId: q.websiteId } }),
          db.websitePlugin.createMany({ data: data.map((p) => ({ websiteId: q.websiteId, slug: p.slug, name: p.name, version: p.version ?? '', active: !!p.active, updateVersion: p.update_version || null })) }),
          db.website.update({ where: { id: q.websiteId }, data: { pluginsAt: new Date() } }),
        ]);
        result.synced++;
      } catch (e) {
        result.failed++;
        console.error('plugin sync failed for', q.websiteId, e instanceof Error ? e.message : e); // the site may have been deleted meanwhile
      }
    }
  }));
  return result;
}

/** Starts the daily read once per server process: a first one two minutes after start. Does nothing until MainWP is set up. */
export function startPluginSync() {
  if (g.__pluginSchedule || !mainwpConfigured()) return;
  g.__pluginSchedule = true;
  const round = () => syncPlugins().catch((e) => console.error('plugin sync failed', e instanceof Error ? e.message : e));
  setTimeout(round, 2 * 60_000).unref();
  setInterval(round, EVERY_HOURS * 3600_000).unref();
}
