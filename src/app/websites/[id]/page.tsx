import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { loadStats, outagesOf } from '@/lib/websiteMonitor';
import { CHECK_EVERY_MIN, STATE_LABEL, ago, hostOf, isMonitored, pct, upClass } from '@/lib/websitesShared';
import Actions from './Actions';

const DAYS = 30;
const when = (d: Date) => d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const span = (ms: number) => { const m = Math.round(ms / 60000); return m < 1 ? 'under a minute' : m < 90 ? `${m} min` : m < 2880 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };

export default async function WebsiteDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await db.website.findUnique({ where: { id } });
  if (!site) notFound();
  const monitored = isMonitored(site);
  const [checks, all] = await Promise.all([
    db.websiteCheck.findMany({ where: { websiteId: id }, orderBy: { at: 'desc' } }),
    loadStats(),
  ]);
  const st = all.get(id);
  const last = st?.last;
  const state = !monitored ? 'off' : !last ? 'none' : last.ok ? 'up' : 'down';

  // One bar per day for the last 30 days.
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const byDay = new Map<string, { up: number; total: number }>();
  for (const c of checks) { const e = byDay.get(day(c.at)) ?? { up: 0, total: 0 }; e.total++; if (c.ok) e.up++; byDay.set(day(c.at), e); }
  const bars = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(Date.now() - (DAYS - 1 - i) * 864e5);
    const e = byDay.get(day(d));
    return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), p: pct(e), n: e?.total ?? 0 };
  });
  const outages = outagesOf(checks).slice(0, 12);
  const avgMs = (() => { const v = checks.filter((c) => c.ok && c.ms != null && Date.now() - c.at.getTime() < 864e5).map((c) => c.ms!); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; })();

  return (
    <div className="page ws-page">
      <div className="page-head">
        <div>
          <p className="muted" style={{ marginBottom: 6 }}><Link href="/websites">← Websites</Link></p>
          <h1 className="h1">{site.clientName}</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            {site.url ? <a href={site.url} target="_blank" rel="noreferrer">{hostOf(site.url)} ↗</a> : 'No website link'} · <span className={`ws-chip ${site.status.toLowerCase() === 'live' ? 'ws-c-live' : 'ws-c-off'}`}>{site.status}</span>
          </p>
        </div>
        <Actions id={site.id} name={site.clientName} canCheck={monitored} />
      </div>

      {!monitored && <div className="card ws-note">This website is not monitored{site.status.toLowerCase() === 'live' ? ' because it has no link' : `, because its status is ${site.status}`}. Only Live websites are checked.</div>}

      <div className="ws-sum">
        <div className="card"><span className={`ws-state ws-s-${state}`}><i />{STATE_LABEL[state]}</span><span>{last ? `Checked ${ago(last.at.toISOString())}${last.ms != null ? ` · ${last.ms} ms` : ''}${last.ok ? '' : ` · ${last.error}`}` : `Checked every ${CHECK_EVERY_MIN} minutes`}</span></div>
        {([['24 hours', st?.d1], ['7 days', st?.d7], ['30 days', st?.d30]] as const).map(([label, s]) => (
          <div className="card" key={label}><b className={upClass(pct(s))}>{pct(s) == null ? '·' : `${pct(s)}%`}</b><span>Uptime, {label}</span></div>
        ))}
        <div className="card"><b>{avgMs == null ? '·' : `${avgMs} ms`}</b><span>Average response, 24 hours</span></div>
      </div>

      <h2 className="ws-h">Last {DAYS} days</h2>
      <div className="card">
        <div className="ws-bars" role="img" aria-label="Uptime for each of the last 30 days">
          {bars.map((b, i) => <i key={i} className={upClass(b.p)} title={`${b.label}: ${b.p == null ? 'no checks' : `${b.p}% (${b.n} checks)`}`} />)}
        </div>
        <div className="ws-axis"><span>{bars[0].label}</span><span>Today</span></div>
      </div>

      <h2 className="ws-h">Outages</h2>
      <div className="card">
        {!outages.length ? <p className="muted">No outages recorded{checks.length ? '.' : ' yet.'}</p> : (
          <table className="ws-mini">
            <thead><tr><th>Started</th><th>Lasted</th><th>Cause</th></tr></thead>
            <tbody>{outages.map((o, i) => (
              <tr key={i}>
                <td>{when(o.from)}</td>
                <td>{o.to ? span(o.to.getTime() - o.from.getTime()) : <span className="ws-bad">Still down</span>}</td>
                <td>{o.error ?? ''}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      <h2 className="ws-h">Recent checks</h2>
      <div className="card">
        {!checks.length ? <p className="muted">No checks yet.</p> : (
          <table className="ws-mini">
            <thead><tr><th>When</th><th>Result</th><th>Response</th><th>Code</th></tr></thead>
            <tbody>{checks.slice(0, 20).map((c) => (
              <tr key={c.id}>
                <td>{when(c.at)}</td>
                <td className={c.ok ? 'ws-good' : 'ws-bad'}>{c.ok ? 'Up' : `Down${c.error ? ` · ${c.error}` : ''}`}</td>
                <td>{c.ms != null ? `${c.ms} ms` : '·'}</td>
                <td>{c.code ?? '·'}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
