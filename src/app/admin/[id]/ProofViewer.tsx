'use client';

import { useEffect, useState } from 'react';

export type Pin = { id: string; imageId: string | null; x: number; y: number; pin: number | null; resolved: boolean; text: string };
export type Goto = { versionId: string; commentId: string; imageId: string | null; fromPin?: boolean };
export const GOTO = 'rp:goto';
export const goto = (d: Goto) => window.dispatchEvent(new CustomEvent<Goto>(GOTO, { detail: d }));

/** One page at a time with pins on it. Clicking a comment (or a pin) anywhere on the board jumps here. */
export default function ProofViewer({ versionId, images, pins }: { versionId: string; images: { id: string; file: string }[]; pins: Pin[] }) {
  const [idx, setIdx] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const img = images[idx];

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<Goto>).detail;
      if (d.versionId !== versionId) return;
      const i = images.findIndex((m) => m.id === d.imageId);
      if (i >= 0) setIdx(i);
      setActive(d.commentId);
    };
    window.addEventListener(GOTO, on);
    return () => window.removeEventListener(GOTO, on);
  }, [versionId, images]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName)) return;
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(images.length - 1, i + 1));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [images.length]);

  const here = pins.filter((p) => p.imageId === img.id);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-zinc-400">Page {idx + 1} of {images.length}</span>
        <div className="flex gap-1.5">
          <button className="btn-ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)} aria-label="Previous page">‹ Prev</button>
          <button className="btn-ghost" disabled={idx === images.length - 1} onClick={() => setIdx(idx + 1)} aria-label="Next page">Next ›</button>
        </div>
      </div>

      <div className="grid place-items-center rounded-lg border border-zinc-800 bg-zinc-950 p-2">
        <div className="relative inline-block">
          <img src={`/files/${img.file}`} alt={`Page ${idx + 1}`} className="block max-h-[62vh] max-w-full" draggable={false} />
          {here.map((p) => (
            <button
              key={p.id} title={p.text} style={{ left: `${p.x}%`, top: `${p.y}%` }}
              onClick={() => goto({ versionId, commentId: p.id, imageId: p.imageId, fromPin: true })}
              className={`absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-lg transition-transform ${
                p.id === active ? 'z-10 scale-150 ring-4 ring-amber-300' : ''
              } ${p.resolved ? 'bg-zinc-500' : 'bg-rose-500'}`}
            >{p.pin}</button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {images.map((m, n) => {
          const count = pins.filter((p) => p.imageId === m.id).length;
          return (
            <button key={m.id} onClick={() => setIdx(n)} aria-label={`Go to page ${n + 1}`} className={`relative shrink-0 rounded border-2 ${n === idx ? 'border-white' : 'border-zinc-800 opacity-70 hover:opacity-100'}`}>
              <img src={`/files/${m.file}`} alt="" loading="lazy" className="block h-14 rounded-sm" />
              <span className="absolute bottom-0 left-0 rounded-tr bg-black/70 px-1 text-[10px]">{n + 1}</span>
              {count > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold">{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
