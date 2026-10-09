'use client';

import Link from 'next/link';
import { useRef } from 'react';
import SubmitButton from '@/components/SubmitButton';
import AiNav from '../AiNav';
import {
  addAiCategory, addAiCriterion, createAiClient, deleteAiCategory, deleteAiClient, deleteAiCriterion,
  moveAiCriterion, renameAiCategory, updateAiClient, updateAiCriterion,
} from '../actions';
import type { AiClientLite, Crit } from '../types';

/** One editable list of criteria. Each row saves when you leave the field; arrows reorder. */
function CriteriaList({ clientId, categoryId, items, placeholder }: { clientId: string; categoryId: string | null; items: Crit[]; placeholder: string }) {
  return (
    <div className="ai-clist">
      {items.map((c, i) => (
        <div key={c.id} className="ai-crow">
          <form action={updateAiCriterion}>
            <input type="hidden" name="id" value={c.id} />
            <input className="input" name="text" defaultValue={c.text} aria-label="Criterion" onBlur={(e) => { if (e.currentTarget.value.trim() !== c.text) e.currentTarget.form?.requestSubmit(); }} />
          </form>
          <form action={moveAiCriterion}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="dir" value="up" /><button className="ai-ibtn" disabled={i === 0} aria-label="Move up">↑</button></form>
          <form action={moveAiCriterion}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="dir" value="down" /><button className="ai-ibtn" disabled={i === items.length - 1} aria-label="Move down">↓</button></form>
          <form action={deleteAiCriterion}><input type="hidden" name="id" value={c.id} /><button className="ai-ibtn del" aria-label="Delete criterion">×</button></form>
        </div>
      ))}
      <form action={addAiCriterion} className="ai-addrow" key={items.length}>
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="categoryId" value={categoryId ?? ''} />
        <input className="input" name="text" placeholder={placeholder} aria-label={placeholder} />
        <button className="btn">Add</button>
      </form>
    </div>
  );
}

export default function ClientsManager({ clients, selectedId }: { clients: AiClientLite[]; selectedId?: string }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const client = clients.find((c) => c.id === selectedId) ?? clients[0];

  return (
    <div className="page ai-page">
      <div className="page-head">
        <div>
          <h1 className="h1">Clients <span className="count">{clients.length}</span></h1>
          <p className="muted" style={{ marginTop: 8 }}>Save a checklist per client and image type. These clients are separate from your proofing clients.</p>
        </div>
        <AiNav />
      </div>

      <div className="ai-clients">
        <aside className="ai-clist-side">
          <button className="btn btn-primary" onClick={() => dlg.current?.showModal()}>+ Add client</button>
          {clients.map((c) => (
            <Link key={c.id} href={`/aireviewer/clients?c=${c.id}`} className={`ai-cside ${client?.id === c.id ? 'on' : ''}`}>
              <b>{c.name}</b>
              <span className="muted">{c.categories.length} types · {c.base.length + c.categories.reduce((n, x) => n + x.criteria.length, 0)} criteria</span>
            </Link>
          ))}
          {!clients.length && <p className="muted">No clients yet.</p>}
        </aside>

        <section className="ai-cdetail">
          {!client && <div className="empty-state"><h2>Add your first client</h2><p>Each client gets six image types to start (Reel, Flyer, Photo Resize, Carousel, Story, Profile Logo). Add checklists to each.</p></div>}
          {client && (
            <>
              <div className="ai-card">
                <form action={updateAiClient} className="ai-editrow">
                  <input type="hidden" name="id" value={client.id} />
                  <input className="input" name="name" defaultValue={client.name} aria-label="Client name" required />
                  <input className="input" name="notes" defaultValue={client.notes ?? ''} placeholder="Notes (optional)" aria-label="Notes" />
                  <SubmitButton className="btn" pending="Saving…">Save</SubmitButton>
                </form>
              </div>

              <div className="ai-card">
                <div className="ai-h"><span>Checked in every image type</span><span className="ai-count">{client.base.length}</span></div>
                <CriteriaList clientId={client.id} categoryId={null} items={client.base} placeholder="Add a criterion for all types" />
              </div>

              {client.categories.map((cat) => (
                <div key={cat.id} className="ai-card">
                  <div className="ai-h">
                    <form action={renameAiCategory} className="ai-catname">
                      <input type="hidden" name="id" value={cat.id} />
                      <input className="input" name="name" defaultValue={cat.name} aria-label="Image type name" onBlur={(e) => { if (e.currentTarget.value.trim() && e.currentTarget.value.trim() !== cat.name) e.currentTarget.form?.requestSubmit(); }} />
                    </form>
                    <span className="ai-count">{cat.criteria.length}</span>
                    <form action={deleteAiCategory}><input type="hidden" name="id" value={cat.id} /><button className="ai-link danger" onClick={(e) => { if (!confirm(`Delete the "${cat.name}" type and its criteria?`)) e.preventDefault(); }}>Delete type</button></form>
                  </div>
                  <CriteriaList clientId={client.id} categoryId={cat.id} items={cat.criteria} placeholder={`Add a criterion for ${cat.name}`} />
                </div>
              ))}

              <form action={addAiCategory} className="ai-addrow ai-newcat" key={client.categories.length}>
                <input type="hidden" name="clientId" value={client.id} />
                <input className="input" name="name" placeholder="+ Add an image type (for example Menu or Banner)" aria-label="New image type" />
                <button className="btn">Add type</button>
              </form>

              <div className="danger-zone">
                <span className="muted">Danger zone</span>
                <form action={deleteAiClient} onSubmit={(e) => { if (!confirm(`Delete "${client.name}" and all their saved checklists? Past reviews stay in History.`)) e.preventDefault(); }}>
                  <input type="hidden" name="id" value={client.id} />
                  <button className="btn-ghost" style={{ color: 'var(--bad)' }}>Delete client…</button>
                </form>
              </div>
            </>
          )}
        </section>
      </div>

      <dialog ref={dlg} className="dlg" onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
        <h2>Add client</h2>
        <form action={createAiClient}>
          <input className="input" name="name" placeholder="Client name" required autoFocus />
          <input className="input" name="notes" placeholder="Notes (optional)" />
          <div className="head-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn-ghost" onClick={() => dlg.current?.close()}>Cancel</button>
            <SubmitButton className="btn btn-primary" pending="Adding…">Add client</SubmitButton>
          </div>
        </form>
      </dialog>
    </div>
  );
}
