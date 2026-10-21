'use client';

import { useEffect, useState } from 'react';
import type { Check } from '@/lib/aiShared';
import type { ReviewText } from '@/lib/aiTranslate';
import { useLang } from './Lang';
import type { ReviewView } from './types';

// Spanish versions already fetched in this browser, and the requests in flight, so each review is asked for once.
const have = new Map<string, ReviewText>();
const asking = new Map<string, Promise<ReviewText | null>>();

function fetchSpanish(id: string) {
  let p = asking.get(id);
  if (!p) {
    p = fetch('/api/aireviewer/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      .then(async (r) => (r.ok ? ((await r.json()) as { es: ReviewText }).es : null))
      .catch(() => null)
      .then((es) => { if (es) have.set(id, es); asking.delete(id); return es; });
    asking.set(id, p);
  }
  return p;
}

/** The words of a review in the chosen language: the original English, or its Spanish version (made once, then kept with the review). */
export function useReviewText(r: ReviewView): { summary: string; actionItems: string[]; checks: Pick<Check, 'criterion' | 'comment'>[]; state: 'original' | 'loading' | 'failed' | 'translated' } {
  const { lang } = useLang();
  const [, tick] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const es = lang === 'es' ? have.get(r.id) ?? r.es ?? null : null;
  if (r.es && !have.has(r.id)) have.set(r.id, r.es);

  useEffect(() => {
    if (lang !== 'es' || have.has(r.id)) return;
    let live = true;
    fetchSpanish(r.id).then((got) => { if (!live) return; if (got) tick((n) => n + 1); else setFailed(r.id); });
    return () => { live = false; };
  }, [lang, r.id]);

  if (lang === 'es' && es && es.checks.length === r.checks.length && es.actionItems.length === r.actionItems.length) {
    return { summary: es.summary, actionItems: es.actionItems, checks: es.checks, state: 'translated' };
  }
  const original = { summary: r.summary, actionItems: r.actionItems, checks: r.checks };
  if (lang !== 'es') return { ...original, state: 'original' };
  return { ...original, state: failed === r.id ? 'failed' : 'loading' };
}
