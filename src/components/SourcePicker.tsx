'use client';

import { useState } from 'react';
import FilePicker from './FilePicker';

/** Chooses what is being reviewed: uploaded images or a PDF, or a live website opened by its address. */
export default function SourcePicker({ initialUrl = '', startLive = false, inputClass = 'input mt-1', note }: { initialUrl?: string; startLive?: boolean; inputClass?: string; note?: string }) {
  const [live, setLive] = useState(startLive);
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="src-seg" role="radiogroup" aria-label="What is being reviewed" style={{ display: 'inline-flex', gap: 2, padding: 3, border: '1px solid var(--line-2)', borderRadius: 99, justifySelf: 'start' }}>
        {([['files', 'Images or PDF'], ['live', 'Live website']] as const).map(([k, label]) => (
          <label key={k} style={{ padding: '7px 14px', borderRadius: 99, cursor: 'pointer', font: '600 13px/1 var(--sans)', background: (k === 'live') === live ? 'var(--surface-3)' : 'transparent', color: (k === 'live') === live ? '#fff' : 'var(--muted)' }}>
            <input type="radio" name="source" value={k} checked={(k === 'live') === live} onChange={() => setLive(k === 'live')} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
            {label}
          </label>
        ))}
      </div>
      {live ? (
        <label className="muted" style={{ display: 'grid', gap: 6 }}>
          {note ?? 'Address of the site to review. It needs the Review Bridge plugin to take comments (see the README).'}
          <input className={inputClass} name="liveUrl" type="url" inputMode="url" placeholder="https://staging.example.com" defaultValue={initialUrl} required />
        </label>
      ) : (
        <label className="muted" style={{ display: 'grid', gap: 6 }}>
          Images or PDF. Proofs are previews, not final artwork: JPG, PNG, WebP or GIF up to 10 MB each, PDF up to 30 MB and 60 pages, 40 MB per upload
          <FilePicker className={inputClass} />
        </label>
      )}
    </div>
  );
}
