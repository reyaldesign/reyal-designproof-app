'use client';

import { useState } from 'react';
import { useLang } from './Lang';
import type { ReviewView } from './types';
import { useReviewText } from './useReviewText';

const ICON = { pass: '✓', warn: '!', fail: '✕' } as const;

/** One review: the image with numbered markers where the AI thinks problems are, the score, why, and what to fix. */
export default function ReviewDetail({ r, imageUrl, footer }: { r: ReviewView; imageUrl: string; footer?: React.ReactNode }) {
  const [hot, setHot] = useState<number | null>(null);
  const [pg, setPg] = useState(0);
  const [copied, setCopied] = useState(false);
  const { t, verdict, locale } = useLang();
  const text = useReviewText(r);
  const v = verdict(r.verdict);
  const marked = r.checks.map((c, i) => ({ c, i })).filter((x) => x.c.status !== 'pass' && x.c.location);
  const num = (i: number) => marked.findIndex((m) => m.i === i) + 1;
  // A review of several pages shows one page at a time, with the markers that belong to it. A single image behaves as it always has.
  const urls = r.pages?.length ? r.pages.map((p) => `/aireviewer/img/${p.file}`) : [imageUrl];
  const pageOf = (c: { location?: { page?: number } }) => Math.min(c.location?.page ?? 0, urls.length - 1);
  const issuesOn = (n: number) => marked.filter((m) => pageOf(m.c) === n).length;

  async function copy() {
    try { await navigator.clipboard.writeText(text.actionItems.map((a) => `- ${a}`).join('\n')); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  }

  return (
    <div className="ai-detail">
      {urls.length > 1 && (
        <div className="ai-pager">
          <button onClick={() => setPg((p) => Math.max(0, p - 1))} disabled={pg === 0} aria-label={t('Previous page')}>‹</button>
          <span>{t('Page {a} of {b}', { a: pg + 1, b: urls.length })}</span>
          <button onClick={() => setPg((p) => Math.min(urls.length - 1, p + 1))} disabled={pg === urls.length - 1} aria-label={t('Next page')}>›</button>
          <span className="ai-pdots">{urls.map((_, n) => <button key={n} className={`${n === pg ? 'on' : ''} ${issuesOn(n) ? 'has' : ''}`} onClick={() => setPg(n)} aria-label={t('Page {n}', { n: n + 1 })}>{n + 1}</button>)}</span>
        </div>
      )}
      <div className={`ai-shot ${r.pages?.length ? 'tall' : ''}`}>
        <div className="ai-shot-in">
          <img src={urls[pg] ?? urls[0]} alt={r.filename} />
          {marked.filter(({ c }) => pageOf(c) === pg).map(({ c, i }) => (
            <span
              key={i}
              className={`ai-mark ${c.status} ${hot === i ? 'hot' : ''}`}
              style={{ left: `${c.location!.x * 100}%`, top: `${c.location!.y * 100}%` }}
              title={text.checks[i]?.criterion ?? c.criterion}
              onMouseEnter={() => setHot(i)}
              onMouseLeave={() => setHot(null)}
            >{num(i)}</span>
          ))}
        </div>
      </div>
      <div className="ai-head">
        <div className={`ai-score ${v.cls}`} style={{ ['--p' as string]: `${r.score}%` }}><b>{r.score}</b></div>
        <div>
          <span className={`ai-verdict ${v.cls}`}>{v.label}</span>
          <div className="ai-fname">{r.filename}</div>
          <div className="ai-sub">{[r.clientName, r.categoryName].filter(Boolean).join(' · ') || t('No client')}{r.createdAt ? ` · ${new Date(r.createdAt).toLocaleString(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}</div>
        </div>
      </div>
      {text.state === 'loading' && <p className="ai-note">{t('Translating…')}</p>}
      {text.state === 'failed' && <p className="ai-note">{t('Showing the original English. The translation is not available right now.')}</p>}
      {text.summary && <p className="ai-summary">{text.summary}</p>}
      {text.actionItems.length > 0 && (
        <section>
          <div className="ai-h"><span>{t('What to fix')}</span><button className="ai-link" onClick={copy}>{copied ? t('Copied') : t('Copy list')}</button></div>
          <ul className="ai-fix">{text.actionItems.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </section>
      )}
      <section>
        <div className="ai-h"><span>{t('Checklist')}</span><span className="ai-count">{t('{a} of {b} passed', { a: r.checks.filter((c) => c.status === 'pass').length, b: r.checks.length })}</span></div>
        <ul className="ai-checks">
          {r.checks.map((c, i) => (
            <li key={i} className={`${c.status} ${hot === i ? 'hot' : ''}`} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)} onClick={() => { if (c.location) setPg(pageOf(c)); }}>
              <i className={`ai-ic ${c.status}`}>{ICON[c.status]}</i>
              <div>
                <b>{text.checks[i]?.criterion ?? c.criterion}{num(i) > 0 && <span className="ai-pin">{num(i)}</span>}</b>
                <span>{text.checks[i]?.comment ?? c.comment}</span>
              </div>
            </li>
          ))}
        </ul>
        {marked.length > 0 && <p className="ai-note">{t("Markers are the AI's best estimate of where a problem is. Treat them as a pointer, not a measurement.")}</p>}
      </section>
      {footer}
    </div>
  );
}
