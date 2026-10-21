'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import SubmitButton from '@/components/SubmitButton';
import { AI_KINDS, type Kind } from '@/lib/aiShared';
import AiNav from '../AiNav';
import ClientIcon from '../ClientIcon';
import { useLang } from '../Lang';
import {
  addAiCategory, addAiCriterion, createAiClient, deleteAiCategory, deleteAiClient, deleteAiCriterion,
  moveAiCriterion, removeAiClientLogo, renameAiCategory, setAiClientLogo, updateAiClient, updateAiCriterion,
} from '../actions';
import type { AiClientLite, Crit } from '../types';

/** One editable list of criteria. Each row saves when you leave the field; arrows reorder. */
function CriteriaList({ clientId, categoryId, items, placeholder, kind }: { clientId: string; categoryId: string | null; items: Crit[]; placeholder: string; kind: Kind }) {
  const { t } = useLang();
  return (
    <div className="ai-clist">
      {items.map((c, i) => (
        <div key={c.id} className="ai-crow">
          <form action={updateAiCriterion}>
            <input type="hidden" name="id" value={c.id} />
            <input className="input" name="text" defaultValue={c.text} aria-label={t('Criterion')} onBlur={(e) => { if (e.currentTarget.value.trim() !== c.text) e.currentTarget.form?.requestSubmit(); }} />
          </form>
          <form action={moveAiCriterion}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="dir" value="up" /><button className="ai-ibtn" disabled={i === 0} aria-label={t('Move up')}>↑</button></form>
          <form action={moveAiCriterion}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="dir" value="down" /><button className="ai-ibtn" disabled={i === items.length - 1} aria-label={t('Move down')}>↓</button></form>
          <form action={deleteAiCriterion}><input type="hidden" name="id" value={c.id} /><button className="ai-ibtn del" aria-label={t('Delete criterion')}>×</button></form>
        </div>
      ))}
      <form action={addAiCriterion} className="ai-addrow" key={items.length}>
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="categoryId" value={categoryId ?? ''} />
        <input type="hidden" name="kind" value={kind} />
        <input className="input" name="text" placeholder={placeholder} aria-label={placeholder} />
        <button className="btn">{t('Add')}</button>
      </form>
    </div>
  );
}

export default function ClientsManager({ clients, selectedId }: { clients: AiClientLite[]; selectedId?: string }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const { t } = useLang();
  const shared = clients.filter((c) => c.general);
  const own = clients.filter((c) => !c.general);
  const client = clients.find((c) => c.id === selectedId) ?? own[0] ?? shared[0];
  const kind: Kind = client?.general ?? 'social'; // a shared list belongs to one review type

  return (
    <div className="page ai-page">
      <div className="page-head">
        <div>
          <h1 className="h1">{t('Review Criteria')} <span className="count">{own.length}</span></h1>
          <p className="muted" style={{ marginTop: 8 }}>{t('Save a checklist per client and media type. These clients are separate from your proofing clients.')}</p>
        </div>
        <AiNav />
      </div>

      <div className="ai-clients">
        <aside className="ai-clist-side">
          <button className="btn btn-primary" onClick={() => dlg.current?.showModal()}>{t('+ Add client')}</button>
          <span className="muted ai-sidelabel">{t('Shared lists')}</span>
          {shared.map((c) => (
            <Link key={c.id} href={`/aireviewer/clients?c=${c.id}`} className={`ai-cside ${client?.id === c.id ? 'on' : ''}`}>
              <ClientIcon name={c.name} logo={null} size={36} />
              <span className="ai-cside-t">
                <b>{t(c.name)}</b>
                <span className="muted">{t('{n} types · {m} criteria', { n: c.categories.length, m: c.base.length + c.categories.reduce((n, x) => n + x.criteria.length, 0) })}</span>
              </span>
            </Link>
          ))}
          <span className="muted ai-sidelabel">{t('Clients')}</span>
          {own.map((c) => (
            <Link key={c.id} href={`/aireviewer/clients?c=${c.id}`} className={`ai-cside ${client?.id === c.id ? 'on' : ''}`}>
              <ClientIcon name={c.name} logo={c.logo} size={36} />
              <span className="ai-cside-t">
                <b>{c.name}</b>
                <span className="muted">{t('{n} types · {m} criteria', { n: c.categories.filter((x) => x.kind === 'social').length, m: c.base.filter((x) => x.kind === 'social').length + c.categories.filter((x) => x.kind === 'social').reduce((n, x) => n + x.criteria.length, 0) })}</span>
              </span>
            </Link>
          ))}
          {!own.length && <p className="muted">{t('No clients yet.')}</p>}
        </aside>

        <section className="ai-cdetail">
          {!client && <div className="empty-state"><h2>{t('Add your first client')}</h2><p>{t('Each client gets six media types to start (Reel, Flyer, Photo Resize, Carousel, Story, Profile Logo). Add checklists to each.')}</p></div>}
          {client && (
            <>
              {client.general && <p className="muted">{t('One list for every {kind} review, not tied to a client. Its media types and criteria load on the Review page.', { kind: t(AI_KINDS.find((k) => k.key === kind)!.label) })}</p>}
              {!client.general && <>
              <div className="ai-card ai-iconcard">
                <ClientIcon name={client.name} logo={client.logo} size={72} />
                <div className="ai-iconctl">
                  <b>{t('Client icon')}</b>
                  <span className="muted">{t('PNG, JPG, WebP or GIF, up to 2 MB. It is cropped to a square.')}</span>
                  <div className="head-actions">
                    <form action={setAiClientLogo}>
                      <input type="hidden" name="id" value={client.id} />
                      <label className="btn">{client.logo ? t('Replace icon') : t('Upload icon')}
                        <input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/gif" hidden
                          onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f && f.size > 2 * 1024 * 1024) { alert(t('That image is over 2 MB. Please choose a smaller one.')); e.currentTarget.value = ''; return; } e.currentTarget.form?.requestSubmit(); }} />
                      </label>
                    </form>
                    {client.logo && <form action={removeAiClientLogo}><input type="hidden" name="id" value={client.id} /><button className="btn-ghost">{t('Remove')}</button></form>}
                  </div>
                </div>
              </div>

              <div className="ai-card">
                <form action={updateAiClient} className="ai-editrow">
                  <input type="hidden" name="id" value={client.id} />
                  <input className="input" name="name" defaultValue={client.name} aria-label={t('Client name')} required />
                  <input className="input" name="notes" defaultValue={client.notes ?? ''} placeholder={t('Notes (optional)')} aria-label={t('Notes (optional)')} />
                  <SubmitButton className="btn" pending={t('Saving…')}>{t('Save')}</SubmitButton>
                </form>
              </div>

              </>}

              <div className="ai-card">
                <div className="ai-h"><span>{t('Checked in every media type')}</span><span className="ai-count">{client.base.filter((c) => c.kind === kind).length}</span></div>
                <CriteriaList clientId={client.id} categoryId={null} items={client.base.filter((c) => c.kind === kind)} placeholder={t('Add a criterion for all types')} kind={kind} />
              </div>

              {!client.categories.some((c) => c.kind === kind) && <p className="muted">{t('No media types for {kind} yet. Add the first one below.', { kind: t(AI_KINDS.find((k) => k.key === kind)!.label) })}</p>}
              {client.categories.filter((c) => c.kind === kind).map((cat) => (
                <div key={cat.id} className="ai-card">
                  <div className="ai-h">
                    <form action={renameAiCategory} className="ai-catname">
                      <input type="hidden" name="id" value={cat.id} />
                      <input className="input" name="name" defaultValue={cat.name} aria-label={t('Media type name')} onBlur={(e) => { if (e.currentTarget.value.trim() && e.currentTarget.value.trim() !== cat.name) e.currentTarget.form?.requestSubmit(); }} />
                    </form>
                    <span className="ai-count">{cat.criteria.length}</span>
                    <form action={deleteAiCategory}><input type="hidden" name="id" value={cat.id} /><button className="ai-link danger" onClick={(e) => { if (!confirm(t('Delete the "{name}" type and its criteria?', { name: cat.name }))) e.preventDefault(); }}>{t('Delete type')}</button></form>
                  </div>
                  <CriteriaList clientId={client.id} categoryId={cat.id} items={cat.criteria} placeholder={t('Add a criterion for {name}', { name: cat.name })} kind={kind} />
                </div>
              ))}

              <form action={addAiCategory} className="ai-addrow ai-newcat" key={client.categories.length}>
                <input type="hidden" name="clientId" value={client.id} />
                <input type="hidden" name="kind" value={kind} />
                <input className="input" name="name" placeholder={t('+ Add a media type (for example Menu or Banner)')} aria-label={t('New media type')} />
                <button className="btn">{t('Add type')}</button>
              </form>

              {!client.general && <div className="danger-zone">
                <span className="muted">{t('Danger zone')}</span>
                <form action={deleteAiClient} onSubmit={(e) => { if (!confirm(t('Delete "{name}" and all their saved checklists? Past reviews stay in History.', { name: client.name }))) e.preventDefault(); }}>
                  <input type="hidden" name="id" value={client.id} />
                  <button className="btn-ghost" style={{ color: 'var(--bad)' }}>{t('Delete client…')}</button>
                </form>
              </div>}
            </>
          )}
        </section>
      </div>

      <dialog ref={dlg} className="dlg" onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
        <h2>{t('Add client')}</h2>
        <form action={createAiClient}>
          <input className="input" name="name" placeholder={t('Client name')} required autoFocus />
          <input className="input" name="notes" placeholder={t('Notes (optional)')} />
          <div className="head-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn-ghost" onClick={() => dlg.current?.close()}>{t('Cancel')}</button>
            <SubmitButton className="btn btn-primary" pending={t('Adding…')}>{t('Add client')}</SubmitButton>
          </div>
        </form>
      </dialog>
    </div>
  );
}
