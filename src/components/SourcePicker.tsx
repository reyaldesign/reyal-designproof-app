'use client';

import { useState } from 'react';
import FilePicker from './FilePicker';

type Source = 'files' | 'live' | 'figma';
const SIZES = [['figmaDesktop', 'Desktop'], ['figmaMobile', 'Phone'], ['figmaTablet', 'Tablet']] as const;

/** Chooses what is being reviewed: uploaded images or a PDF, a live website opened by its address, or a Figma prototype. */
export default function SourcePicker({ initialUrl = '', startLive = false, start, figma = {}, inputClass = 'input mt-1', note }: {
  initialUrl?: string; startLive?: boolean; start?: Source; figma?: { desktop?: string; tablet?: string; mobile?: string }; inputClass?: string; note?: string;
}) {
  const [source, setSource] = useState<Source>(start ?? (startLive ? 'live' : 'files'));
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="src-seg" role="radiogroup" aria-label="What is being reviewed" style={{ display: 'inline-flex', gap: 2, padding: 3, border: '1px solid var(--line-2)', borderRadius: 99, justifySelf: 'start', flexWrap: 'wrap' }}>
        {([['files', 'Images or PDF'], ['live', 'Live website'], ['figma', 'Figma prototype']] as const).map(([k, label]) => (
          <label key={k} style={{ padding: '7px 14px', borderRadius: 99, cursor: 'pointer', font: '600 13px/1 var(--sans)', background: source === k ? 'var(--surface-3)' : 'transparent', color: source === k ? '#fff' : 'var(--muted)' }}>
            <input type="radio" name="source" value={k} checked={source === k} onChange={() => setSource(k)} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
            {label}
          </label>
        ))}
      </div>
      {source === 'live' && (
        <label className="muted" style={{ display: 'grid', gap: 6 }}>
          {note ?? 'Address of the site to review. It needs the Review Bridge plugin to take comments (see the README).'}
          <input className={inputClass} name="liveUrl" type="url" inputMode="url" placeholder="https://staging.example.com" defaultValue={initialUrl} required />
        </label>
      )}
      {source === 'figma' && (
        <div className="muted" style={{ display: 'grid', gap: 8 }}>
          <span>Paste the Figma prototype link (the Present link) for each screen size. Leave a size empty if there is no design for it. The Figma file must allow anyone with the link to view.</span>
          {SIZES.map(([name, label]) => (
            <label key={name} style={{ display: 'grid', gap: 4 }}>
              {label}
              <input className={inputClass} name={name} type="url" inputMode="url" placeholder="https://www.figma.com/proto/…" defaultValue={figma[name === 'figmaDesktop' ? 'desktop' : name === 'figmaTablet' ? 'tablet' : 'mobile'] ?? ''} />
            </label>
          ))}
        </div>
      )}
      {source === 'files' && (
        <label className="muted" style={{ display: 'grid', gap: 6 }}>
          Images or PDF. Proofs are previews, not final artwork: JPG, PNG, WebP or GIF up to 10 MB each, PDF up to 30 MB and 60 pages, 40 MB per upload
          <FilePicker className={inputClass} />
        </label>
      )}
    </div>
  );
}
