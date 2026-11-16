import { db } from './db';

// Tells WordPress websites from the rest by looking at the home page: WordPress puts its files under /wp-content/ and /wp-includes/.
// A website that already has a platform is left alone, so a value set by hand stays. MainWP also marks the sites it manages as WordPress.

const TIMEOUT_MS = 20_000;
const PARALLEL = 5;
const EVERY_HOURS = 24;
const WORDPRESS = /\/wp-content\/|\/wp-includes\/|<meta[^>]+name=["']generator["'][^>]+content=["']WordPress/i;

/** WordPress or Other, or null when the website did not answer, so it is tried again next time. */
async function detectPlatform(url: string): Promise<'WordPress' | 'Other' | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': 'ReyalUptime/1.0 (+https://client.reyaldesign.com)', accept: 'text/html,*/*' },
    });
    if (!res.ok) return null;
    return WORDPRESS.test(await res.text()) ? 'WordPress' : 'Other';
  } catch { return null; }
}

/** Fills in the platform of every website that has none yet, or of just the given ones. */
export async function scanPlatforms(ids?: string[]) {
  const queue = await db.website.findMany({ where: { platform: '', url: { not: '' }, ...(ids ? { id: { in: ids } } : {}) }, select: { id: true, url: true, server: true, pluginsAt: true } });
  await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      // MainWP only manages WordPress. A Shopify store is never WordPress, and it often turns a bot away.
      const platform = s.pluginsAt ? 'WordPress' : s.server === 'Shopify' ? 'Other' : await detectPlatform(s.url);
      if (platform) await db.website.updateMany({ where: { id: s.id, platform: '' }, data: { platform } }); // a value set meanwhile wins
    }
  }));
}

const g = globalThis as unknown as { __platformScan?: boolean };

/** Starts the daily scan once per server process: a first one 90 seconds after start. */
export function startPlatformScan() {
  if (g.__platformScan) return;
  g.__platformScan = true;
  const round = () => scanPlatforms().catch((e) => console.error('platform scan failed', e));
  setTimeout(round, 90_000).unref();
  setInterval(round, EVERY_HOURS * 3600_000).unref();
}
