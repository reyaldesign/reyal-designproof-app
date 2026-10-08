'use client';

import { useState } from 'react';
import Dialog from '../Dialog';
import { markSent } from '../actions';

/** Share the review link with the client. Nothing is emailed automatically: copy the link or open a ready-made email draft. */
export default function SendToClient({ id, link, title, clientName, clientEmail, status }: {
  id: string; link: string; title: string; clientName: string; clientEmail: string | null; status: string;
}) {
  const [copied, setCopied] = useState(false);
  const subject = `Your proof is ready to review: ${title}`;
  const body = `Hi ${clientName},\n\nYour proof "${title}" is ready. You can review it and leave comments directly on the design here:\n\n${link}\n\nThank you,\nReyal Design`;
  const mailto = `mailto:${clientEmail ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <Dialog label="Send to client" title="Send to client" wide>
      <div style={{ display: 'grid', gap: 12 }}>
        <p className="muted">Share this link with {clientName}. They can comment without an account.</p>
        <div className="head-actions" style={{ flexWrap: 'nowrap' }}>
          <input className="input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          <button
            className="btn"
            onClick={async () => {
              try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked: the field above can be copied by hand */ }
            }}
          >{copied ? 'Copied' : 'Copy link'}</button>
        </div>
        <a className="btn" href={mailto}>Open email draft{clientEmail ? ` to ${clientEmail}` : ''}</a>
        {!clientEmail && <p className="muted" style={{ fontSize: 12 }}>This client has no email on file. Add one with Edit client to prefill the draft.</p>}
        <form action={markSent}>
          <input type="hidden" name="id" value={id} />
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={status !== 'Draft'}>{status === 'Draft' ? 'Mark as sent' : `Status: ${status}`}</button>
        </form>
      </div>
    </Dialog>
  );
}
