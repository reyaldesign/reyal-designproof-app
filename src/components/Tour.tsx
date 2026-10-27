'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import './tour.css';

export type TourStep = {
  /** CSS selector of the area to light up. Leave empty for a plain welcome card in the middle. */
  target: string;
  title: string;
  body: string;
  /** Which side of the area the card prefers. It moves if there is no room. */
  place?: 'top' | 'bottom' | 'left' | 'right';
};
type Box = { x: number; y: number; w: number; h: number };

const PAD = 8; // space around the lit area
const GAP = 16; // space between the lit area and the card
const CARD_W = 340;

const visible = (sel: string) => {
  const el = document.querySelector(sel);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
};

/**
 * A guided tour: the page dims, one area is lit with a pulsing outline, and a card beside it says what it is for.
 * Steps whose area is not on screen are left out. Esc skips, the arrow keys move between steps.
 * onClose(never): never is true when the person ticked "Don't show this again".
 */
export default function Tour({ steps, open, onClose }: { steps: TourStep[]; open: boolean; onClose: (never: boolean) => void }) {
  const [list, setList] = useState<TourStep[]>([]);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [never, setNever] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const step = list[i];
  const last = i === list.length - 1;

  const stepsRef = useRef(steps);
  stepsRef.current = steps; // the caller may build the steps again on every render; the tour only reads them when it opens
  useEffect(() => {
    if (!open) return;
    setList(stepsRef.current.filter((s) => !s.target || visible(s.target)));
    setI(0);
    setNever(false);
  }, [open]);

  // Follow the lit area while the page moves under it, and place the card where it fits.
  const place = useCallback(() => {
    if (!step) return;
    const el = step.target ? document.querySelector(step.target) : null;
    const r = el?.getBoundingClientRect();
    const b = r && r.width > 0 ? { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 } : null;
    setBox((o) => (o && b && o.x === b.x && o.y === b.y && o.w === b.w && o.h === b.h ? o : b));
    const c = card.current?.getBoundingClientRect();
    const cw = Math.min(CARD_W, innerWidth - 24), ch = c?.height ?? 190;
    if (!b || innerWidth < 700) { setPos(null); return; } // welcome card, or a phone: the card sits in the middle or along the bottom
    const sides = { right: { left: b.x + b.w + GAP, top: b.y + b.h / 2 - ch / 2 }, left: { left: b.x - GAP - cw, top: b.y + b.h / 2 - ch / 2 }, bottom: { left: b.x + b.w / 2 - cw / 2, top: b.y + b.h + GAP }, top: { left: b.x + b.w / 2 - cw / 2, top: b.y - GAP - ch } };
    const order = [step.place ?? 'right', 'right', 'left', 'bottom', 'top'] as const;
    const fits = (p: { left: number; top: number }) => p.left >= 12 && p.top >= 12 && p.left + cw <= innerWidth - 12 && p.top + ch <= innerHeight - 12;
    const found = order.map((s) => sides[s]).find(fits) ?? sides[order[0]];
    setPos({ left: Math.max(12, Math.min(found.left, innerWidth - cw - 12)), top: Math.max(12, Math.min(found.top, innerHeight - ch - 12)) });
  }, [step]);

  useEffect(() => {
    if (!open || !step) return;
    if (step.target) document.querySelector(step.target)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    place();
    const t = setInterval(place, 250);
    addEventListener('resize', place);
    return () => { clearInterval(t); removeEventListener('resize', place); };
  }, [open, step, place]);

  useEffect(() => { if (open && step) next.current?.focus(); }, [open, i, step]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(never);
      else if (e.key === 'ArrowRight') setI((n) => Math.min(list.length - 1, n + 1));
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [open, list.length, never, onClose]);

  if (!open || !step) return null;
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-h">
      {box ? <div className="tour-hl" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} aria-hidden /> : <div className="tour-dim" aria-hidden />}
      <div ref={card} className={`tour-card ${pos ? '' : box ? 'dock' : 'mid'}`} style={pos ? { left: pos.left, top: pos.top } : undefined}>
        <div className="tour-count">Step {i + 1} of {list.length}</div>
        <h2 id="tour-h">{step.title}</h2>
        <p>{step.body}</p>
        <div className="tour-actions">
          {i > 0 && <button className="tour-back" onClick={() => setI(i - 1)}>Back</button>}
          <button ref={next} className="tour-next" onClick={() => (last ? onClose(never) : setI(i + 1))}>{last ? 'Done' : 'Next'}</button>
        </div>
        <div className="tour-foot">
          <label><input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} /> Don&apos;t show this again</label>
          <button className="tour-skip" onClick={() => onClose(never)}>Skip tour</button>
        </div>
      </div>
    </div>
  );
}
