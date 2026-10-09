'use client';

import { useEffect, useState } from 'react';

type Item = { id: string; title: string; url: string; thumb: string; image: boolean };

/** The task's attachments. Images open in a large preview you can step through. Other files open in a new tab. */
export default function Gallery({ items }: { items: Item[] }) {
  const images = items.filter((i) => i.image);
  const [at, setAt] = useState<number | null>(null);
  const step = (d: number) => setAt((i) => (i === null ? i : (i + d + images.length) % images.length));

  useEffect(() => {
    if (at === null) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setAt(null); } // not the drawer's own Escape
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [at, images.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = at === null ? null : images[at];
  return (
    <>
      {items.map((a) => a.image
        ? <button key={a.id} type="button" className="cu-thumb" style={{ backgroundImage: `url(${JSON.stringify(a.thumb)})` }} aria-label={`Preview ${a.title}`} onClick={() => setAt(images.indexOf(a))} />
        : <a key={a.id} className="cu-file" href={a.url} target="_blank" rel="noreferrer">{a.title}</a>)}
      {shown && (
        <div className="cu-lb" role="dialog" aria-label={`Preview of ${shown.title}`} onClick={() => setAt(null)}>
          <div className="cu-lbbar" onClick={(e) => e.stopPropagation()}>
            <b>{shown.title}</b>{images.length > 1 && <span>{(at ?? 0) + 1} / {images.length}</span>}
            <a href={shown.url} target="_blank" rel="noreferrer">Open original ↗</a>
            <button type="button" onClick={() => setAt(null)} aria-label="Close preview">×</button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown.url} alt={shown.title} onClick={(e) => e.stopPropagation()} />
          {images.length > 1 && <>
            <button type="button" className="cu-lbnav prev" onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous image">‹</button>
            <button type="button" className="cu-lbnav next" onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next image">›</button>
          </>}
        </div>
      )}
    </>
  );
}
