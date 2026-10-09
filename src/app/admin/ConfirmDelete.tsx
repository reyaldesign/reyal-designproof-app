'use client';

import { useRef } from 'react';
import SubmitButton from '@/components/SubmitButton';

/** Asks before deleting. As a proof, it is a small trash button on the card; as a client, a text button inside Edit client. */
export default function ConfirmDelete({ id, name, action, kind = 'proof' }: {
  id: string; name: string; action: (f: FormData) => Promise<void>; kind?: 'proof' | 'client';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = () => ref.current?.showModal();
  return (
    <>
      {kind === 'proof' ? (
        <button type="button" className="del-btn" aria-label={`Delete ${name}`} title="Delete proof" onClick={open}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" /></svg>
        </button>
      ) : (
        <button type="button" className="btn-ghost" style={{ color: 'var(--bad)' }} onClick={open}>Delete client…</button>
      )}
      <dialog ref={ref} className="dlg" onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        <h2>{kind === 'proof' ? 'Delete this proof?' : 'Delete this client?'}</h2>
        <p className="muted" style={{ marginBottom: 16 }}>
          {kind === 'proof'
            ? <>&ldquo;{name}&rdquo; will be permanently removed with all its versions, comments and uploaded files. The client&rsquo;s review link will stop working. This cannot be undone.</>
            : <>&ldquo;{name}&rdquo; and <b>all of their proofs</b>, versions, comments and uploaded files will be permanently removed. Their review links will stop working. This cannot be undone.</>}
        </p>
        <form action={action} className="head-actions" style={{ justifyContent: 'flex-end' }}>
          <input type="hidden" name="id" value={id} />
          <button type="button" className="btn-ghost" onClick={() => ref.current?.close()}>Cancel</button>
          <SubmitButton className="btn btn-danger" pending="Deleting…">{kind === 'proof' ? 'Delete proof' : 'Delete client'}</SubmitButton>
        </form>
      </dialog>
    </>
  );
}
