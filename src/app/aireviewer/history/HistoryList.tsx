'use client';

import { useMemo, useState } from 'react';
import SubmitButton from '@/components/SubmitButton';
import { AI_KINDS, VERDICT_LABEL, type Kind, type Verdict } from '@/lib/aiShared';
import AiNav from '../AiNav';
import ClientIcon from '../ClientIcon';
import { useLang } from '../Lang';
import ReviewDetail from '../ReviewDetail';
import { deleteAiReview, setAiVerdict } from '../actions';
import type { ReviewView } from '../types';

export type HistoryRow = ReviewView & { createdAt: string };
type Filter = 'all' | Verdict;

const dayLabel = (iso: string, tr: (s: string) => string, locale: string) => {
  const d = new Date(iso), t = new Date();
  const y = new Date();
  y.setDate(t.getDate() - 1);
  return d.toDateString() === t.toDateString() ? tr('Today') : d.toDateString() === y.toDateString() ? tr('Yesterday') : d.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' });
};

export default function HistoryList({ rows }: { rows: HistoryRow[] }) {
  const { t, verdict, locale } = useLang();
  const [status, setStatus] = useState<Filter>('all');
  const [client, setClient] = useState('');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'' | Kind>('');
  const [open, setOpen] = useState<string | null>(null);

  const clients = useMemo(() => [...new Set(rows.map((r) => r.clientName).filter((x): x is string => !!x))].sort(), [rows]);
  const categories = useMemo(() => [...new Set(rows.filter((r) => !client || r.clientName === client).map((r) => r.categoryName).filter((x): x is string => !!x))].sort(), [rows, client]);
  const shown = rows.filter((r) => (status === 'all' || r.verdict === status) && (!kind || (r.kind ?? 'social') === kind) && (!client || r.clientName === client) && (!category || r.categoryName === category) && (!q.trim() || r.filename.toLowerCase().includes(q.trim().toLowerCase())));
  const groups = shown.reduce<Record<string, HistoryRow[]>>((acc, r) => { (acc[dayLabel(r.createdAt, t, locale)] ??= []).push(r); return acc; }, {});
  const sel = rows.find((r) => r.id === open);

  return (
    <div className="page ai-page">
      <div className="page-head">
        <div>
          <h1 className="h1">{t('History')} <span className="count">{rows.length}</span></h1>
          <p className="muted" style={{ marginTop: 8 }}>{t('Every review is saved with the checklist it used.')}</p>
        </div>
        <AiNav />
      </div>

      <div className="ai-hfilters">
        <div className="segbar" role="tablist" aria-label={t('Filter by result')}>
          {([['all', 'All'], ['approved', 'Ready'], ['needs_review', 'Needs revisions'], ['rejected', 'Fails']] as [Filter, string][]).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={status === k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{t(label)}</button>
          ))}
        </div>
        <select className="input ai-sel" value={kind} onChange={(e) => setKind(e.target.value as '' | Kind)} aria-label={t('Review type')}>
          <option value="">{t('All review types')}</option>
          {AI_KINDS.map((k) => <option key={k.key} value={k.key}>{t(k.label)}</option>)}
        </select>
        <select className="input ai-sel" value={client} onChange={(e) => { setClient(e.target.value); setCategory(''); }} aria-label={t('Client')}>
          <option value="">{t('All clients')}</option>
          {clients.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="input ai-sel" value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t('Image type')}>
          <option value="">{t('All image types')}</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="search"><input type="search" placeholder={t('Search file names')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('Search file names')} /></label>
      </div>

      {!rows.length && <div className="empty-state"><h2>{t('No reviews yet')}</h2><p>{t('Reviews you run on the AI Review page are saved here.')}</p></div>}
      {rows.length > 0 && !shown.length && <div className="empty-state"><p>{t('No reviews match these filters.')}</p></div>}
      {Object.entries(groups).map(([day, list]) => (
        <section key={day} className="ai-day">
          <div className="section-title">{day}</div>
          <div className="ai-rows">
            {list.map((r) => {
              const v = { ...VERDICT_LABEL[r.verdict], ...verdict(r.verdict) };
              return (
                <button key={r.id} className="ai-row" onClick={() => setOpen(r.id)}>
                  <span className="ai-rthumb"><img src={`/aireviewer/img/${r.imageFile}?w=320`} alt="" loading="lazy" /></span>
                  <span className="ai-rmain"><b>{r.filename}</b><span className="muted ai-rclient">{r.clientName && <ClientIcon name={r.clientName} logo={r.clientLogo} size={16} />}{[r.clientName, r.categoryName].filter(Boolean).join(' · ') || t('No client')}<span className="ai-kindbadge">{t(AI_KINDS.find((k) => k.key === (r.kind ?? 'social'))?.label ?? 'Social media')}</span>{(r.pages?.length ?? 0) > 1 && <span>{t('{n} pages', { n: r.pages!.length })}</span>}</span></span>
                  <span className={`ai-verdict ${v.cls}`}>{r.score} · {v.short}</span>
                  <span className="ago">{new Date(r.createdAt).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {sel && (
        <>
          <div className="ai-scrim" onClick={() => setOpen(null)} />
          <aside className="ai-panel" role="dialog" aria-label={t('Review detail')}>
            <div className="ai-panel-top"><span>{t('Review')}</span><button onClick={() => setOpen(null)}>{t('Close')}</button></div>
            <ReviewDetail
              r={sel}
              imageUrl={`/aireviewer/img/${sel.imageFile}`}
              footer={
                <div className="ai-foot">
                  <form action={setAiVerdict} className="ai-verdictform">
                    <input type="hidden" name="id" value={sel.id} />
                    <label>{t('Change the result')}
                      <select className="input" name="verdict" defaultValue={sel.verdict} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
                        <option value="approved">{verdict('approved').label}</option>
                        <option value="needs_review">{verdict('needs_review').label}</option>
                        <option value="rejected">{verdict('rejected').label}</option>
                      </select>
                    </label>
                  </form>
                  <form action={async (f) => { await deleteAiReview(f); setOpen(null); }}>
                    <input type="hidden" name="id" value={sel.id} />
                    <SubmitButton className="btn btn-danger" pending={t('Deleting…')}>{t('Delete review')}</SubmitButton>
                  </form>
                </div>
              }
            />
          </aside>
        </>
      )}
    </div>
  );
}
