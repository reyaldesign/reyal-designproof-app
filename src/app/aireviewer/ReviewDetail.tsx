'use client';

import { useState } from 'react';
import { VERDICT_LABEL } from '@/lib/aiShared';
import type { ReviewView } from './types';

const ICON = { pass: '✓', warn: '!', fail: '✕' } as const;

/** One review: the image with numbered markers where the AI thinks problems are, the score, why, and what to fix. */
export default function ReviewDetail({ r, imageUrl, footer }: { r: ReviewView; imageUrl: string; footer?: React.ReactNode }) {
  const [hot, setHot] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const v = VERDICT_LABEL[r.verdict];
  const marked = r.checks.map((c, i) => ({ c, i })).filter((x) => x.c.status !== 'pass' && x.c.location);
  const num = (i: number) => marked.findIndex((m) => m.i === i) + 1;

  async function copy() {
    try { await navigator.clipboard.writeText(r.actionItems.map((a) => `- ${a}`).join('\n')); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  }

  return (
    <div className="ai-detail">
      <div className="ai-shot">
        <div className="ai-shot-in">
          <img src={imageUrl} alt={r.filename} />
          {marked.map(({ c, i }, n) => (
            <span
              key={i}
              className={`ai-mark ${c.status} ${hot === i ? 'hot' : ''}`}
              style={{ left: `${c.location!.x * 100}%`, top: `${c.location!.y * 100}%` }}
              title={c.criterion}
              onMouseEnter={() => setHot(i)}
              onMouseLeave={() => setHot(null)}
            >{n + 1}</span>
          ))}
        </div>
      </div>
      <div className="ai-head">
        <div className={`ai-score ${v.cls}`} style={{ ['--p' as string]: `${r.score}%` }}><b>{r.score}</b></div>
        <div>
          <span className={`ai-verdict ${v.cls}`}>{v.label}</span>
          <div className="ai-fname">{r.filename}</div>
          <div className="ai-sub">{[r.clientName, r.categoryName].filter(Boolean).join(' · ') || 'No client'}{r.createdAt ? ` · ${new Date(r.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}</div>
        </div>
      </div>
      {r.summary && <p className="ai-summary">{r.summary}</p>}
      {r.actionItems.length > 0 && (
        <section>
          <div className="ai-h"><span>What to fix</span><button className="ai-link" onClick={copy}>{copied ? 'Copied' : 'Copy list'}</button></div>
          <ul className="ai-fix">{r.actionItems.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </section>
      )}
      <section>
        <div className="ai-h"><span>Checklist</span><span className="ai-count">{r.checks.filter((c) => c.status === 'pass').length} of {r.checks.length} passed</span></div>
        <ul className="ai-checks">
          {r.checks.map((c, i) => (
            <li key={i} className={`${c.status} ${hot === i ? 'hot' : ''}`} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}>
              <i className={`ai-ic ${c.status}`}>{ICON[c.status]}</i>
              <div>
                <b>{c.criterion}{num(i) > 0 && <span className="ai-pin">{num(i)}</span>}</b>
                <span>{c.comment}</span>
              </div>
            </li>
          ))}
        </ul>
        {marked.length > 0 && <p className="ai-note">Markers are the AI&apos;s best estimate of where a problem is. Treat them as a pointer, not a measurement.</p>}
      </section>
      {footer}
    </div>
  );
}
