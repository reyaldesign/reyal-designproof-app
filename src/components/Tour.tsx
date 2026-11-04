'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import './tour.css';

export type TourStep = {
  /** CSS selector of the area to light up. Leave empty for a plain welcome card in the middle. */
  target: string;
  title: string;
  body: string;
  /** Which side of the area the card prefers. It moves if there is no room. */
  place?: 'top' | 'bottom' | 'left' | 'right' | 'inside';
  /** Label of the button that moves on from this step. */
  next?: string;
};
type Box = { x: number; y: number; w: number; h: number };

const PAD = 8; // space around the lit area
const GAP = 16; // space between the lit area and the card
const CARD_W = 340;

// The first matching element that is actually on screen (the same step can have one target on a laptop and another on a phone).
const find = (sel: string) => [...document.querySelectorAll(sel)].find((el) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
}) ?? null;

/**
 * A guided tour: the page dims, one area is lit with a ring, and a card beside it says what it is for.
 * Every step is always counted, so the total never changes while the tour is open. A step whose area is not on screen
 * (on a small screen, for example) shows its card in the middle instead. Esc or Skip tour closes it, the arrow keys move between steps.
 */
/** onClose(done): done is true when the last step was finished, false when the tour was skipped. */
export default function Tour({ steps, open, onClose }: { steps: TourStep[]; open: boolean; onClose: (done: boolean) => void }) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const step = steps[Math.min(i, steps.length - 1)];
  const last = i === steps.length - 1;

  useEffect(() => { if (open) setI(0); }, [open]);

  // Follow the lit area while the page moves under it, and place the card where it fits.
  const place = useCallback(() => {
    if (!step) return;
    const el = step.target ? find(step.target) : null;
    const r = el?.getBoundingClientRect();
    const b = r ? { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 } : null;
    setBox((o) => (o && b && o.x === b.x && o.y === b.y && o.w === b.w && o.h === b.h ? o : b));
    const c = card.current?.getBoundingClientRect();
    const cw = Math.min(CARD_W, innerWidth - 24), ch = c?.height ?? 210;
    if (!b || innerWidth < 700) { setPos(null); return; } // a welcome card, or a phone: the card sits in the middle or along the bottom
    const sides = { inside: { left: b.x + b.w / 2 - cw / 2, top: b.y + b.h - ch - 28 }, right: { left: b.x + b.w + GAP, top: b.y + b.h / 2 - ch / 2 }, left: { left: b.x - GAP - cw, top: b.y + b.h / 2 - ch / 2 }, bottom: { left: b.x + b.w / 2 - cw / 2, top: b.y + b.h + GAP }, top: { left: b.x + b.w / 2 - cw / 2, top: b.y - GAP - ch } };
    const order = [step.place ?? 'right', 'right', 'left', 'bottom', 'top', 'inside'] as const;
    const fits = (p: { left: number; top: number }) => p.left >= 12 && p.top >= 12 && p.left + cw <= innerWidth - 12 && p.top + ch <= innerHeight - 12;
    const found = order.map((s) => sides[s]).find(fits) ?? sides[order[0]];
    setPos({ left: Math.max(12, Math.min(found.left, innerWidth - cw - 12)), top: Math.max(12, Math.min(found.top, innerHeight - ch - 12)) });
  }, [step]);

  useEffect(() => {
    if (!open || !step) return;
    if (step.target) find(step.target)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    place();
    const t = setInterval(place, 250);
    addEventListener('resize', place);
    return () => { clearInterval(t); removeEventListener('resize', place); };
  }, [open, step, place]);

  useEffect(() => { if (open && step) next.current?.focus(); }, [open, i, step]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(false);
      else if (e.key === 'ArrowRight') setI((n) => Math.min(steps.length - 1, n + 1));
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [open, steps.length, onClose]);

  if (!open || !step) return null;
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-h">
      {box ? <div className="tour-hl" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} aria-hidden /> : <div className="tour-dim" aria-hidden />}
      <div ref={card} className={`tour-card ${pos ? '' : box ? 'dock' : 'mid'}`} style={pos ? { left: pos.left, top: pos.top } : undefined}>
        <div className="tour-top">
          <span className="tour-count">Step {i + 1} of {steps.length}</span>
          <button className="tour-skip" onClick={() => onClose(false)}>Skip tour</button>
        </div>
        <div className="tour-dots" aria-hidden>{steps.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
        <h2 id="tour-h">{step.title}</h2>
        <p>{step.body}</p>
        <div className="tour-actions">
          {i > 0 && <button className="tour-back" onClick={() => setI(i - 1)}>Back</button>}
          <button ref={next} className="tour-next" onClick={() => (last ? onClose(true) : setI(i + 1))}>{step.next ?? (last ? 'Done' : 'Next')}</button>
        </div>
      </div>
    </div>
  );
}
