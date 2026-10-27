import { db } from './db';
import { CHECK_EVERY_MIN, KEEP_DAYS, MONITORED, type Stat } from './websitesShared';

const TIMEOUT_MS = 15_000;
const PARALLEL = 5;

export type CheckResult = { ok: boolean; code: number | null; ms: number | null; error: string | null };

/** One visit to a site's home page. Up means it answered with a normal page. Some firewalls answer a bot with 401, 403 or 429, which still means the site is running. */
export async function checkSite(url: string): Promise<CheckResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': 'ReyalUptime/1.0 (+https://client.reyaldesign.com)', accept: 'text/html,*/*' },
    });
    const ms = Date.now() - t0;
    res.body?.cancel().catch(() => {}); // only the answer matters, not the page
    const ok = res.status < 400 || [401, 403, 429].includes(res.status);
    return { ok, code: res.status, ms, error: ok ? null : `HTTP ${res.status}` };
  } catch (e) {
    const err = e as { name?: string; cause?: { code?: string } };
    const error = err.name === 'TimeoutError' ? 'Timed out' : err.cause?.code === 'ENOTFOUND' ? 'Address not found' : err.cause?.code ? `Connection error (${err.cause.code})` : 'Could not connect';
    return { ok: false, code: null, ms: null, error };
  }
}

/** Checks the given sites (or every Live one) and stores each result. */
export async function runChecks(ids?: string[]) {
  const sites = await db.website.findMany({ where: { status: MONITORED, url: { not: '' }, ...(ids ? { id: { in: ids } } : {}) }, select: { id: true, url: true } });
  const queue = [...sites];
  await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      const r = await checkSite(s.url);
      await db.websiteCheck.create({ data: { websiteId: s.id, ...r } }).catch(() => {}); // the site may have been deleted meanwhile
    }
  }));
  return sites.length;
}

const g = globalThis as unknown as { __websiteMonitor?: boolean };

/** Starts the schedule once per server process: a first round a minute after start, then every CHECK_EVERY_MIN minutes. */
export function startMonitor() {
  if (g.__websiteMonitor || process.env.WEBSITES_MONITOR === 'off') return;
  g.__websiteMonitor = true;
  const round = async () => {
    try {
      await runChecks();
      await db.websiteCheck.deleteMany({ where: { at: { lt: new Date(Date.now() - KEEP_DAYS * 864e5) } } });
    } catch (e) { console.error('website check round failed', e); }
  };
  setTimeout(round, 60_000).unref();
  setInterval(round, CHECK_EVERY_MIN * 60_000).unref();
}

// ----- numbers for the screens -----
export type SiteStats = { last?: { at: Date; ok: boolean; ms: number | null; code: number | null; error: string | null }; d1?: Stat; d7?: Stat; d30?: Stat };

/** Latest result and 24 hour, 7 day and 30 day uptime for every site, in three small queries. */
export async function loadStats(): Promise<Map<string, SiteStats>> {
  const out = new Map<string, SiteStats>();
  const entry = (id: string) => { let e = out.get(id); if (!e) { e = {}; out.set(id, e); } return e; };
  const now = Date.now();
  for (const [key, days] of [['d1', 1], ['d7', 7], ['d30', 30]] as const) {
    const rows = await db.websiteCheck.groupBy({ by: ['websiteId', 'ok'], where: { at: { gte: new Date(now - days * 864e5) } }, _count: { _all: true } });
    for (const r of rows) {
      const e = entry(r.websiteId);
      const s = (e[key] ??= { up: 0, total: 0 });
      s.total += r._count._all;
      if (r.ok) s.up += r._count._all;
    }
  }
  const latest = await db.websiteCheck.findMany({ orderBy: { at: 'desc' }, distinct: ['websiteId'], select: { websiteId: true, at: true, ok: true, ms: true, code: true, error: true } });
  for (const l of latest) entry(l.websiteId).last = { at: l.at, ok: l.ok, ms: l.ms, code: l.code, error: l.error };
  return out;
}

export type Outage = { from: Date; to: Date | null; checks: number; error: string | null };
/** Runs of failed checks in a row, newest first. An outage with no end is still going. */
export function outagesOf(checks: { at: Date; ok: boolean; error: string | null }[]): Outage[] {
  const out: Outage[] = [];
  let cur: Outage | null = null;
  for (const c of [...checks].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    if (!c.ok) { if (cur) cur.checks++; else cur = { from: c.at, to: null, checks: 1, error: c.error }; }
    else if (cur) { cur.to = c.at; out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out.reverse();
}
