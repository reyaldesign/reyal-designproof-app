'use client';

import { useEffect, useRef, useState } from 'react';
import { GOTO, goto, type Goto } from './ProofViewer';

/** Wraps a comment card: clicking it shows its page and pin in the viewer, and it lights up when its pin is chosen. */
export default function CardShell({ versionId, commentId, imageId, resolved, children }: {
  versionId: string; commentId: string; imageId: string | null; resolved: boolean; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<Goto>).detail;
      if (d.versionId !== versionId) return;
      setOn(d.commentId === commentId);
      if (d.commentId === commentId && d.fromPin) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    window.addEventListener(GOTO, h);
    return () => window.removeEventListener(GOTO, h);
  }, [versionId, commentId]);

  return (
    <div
      ref={ref}
      className={`card ${imageId ? 'cursor-pointer' : ''} ${on ? 'ring-2 ring-amber-400' : ''} ${resolved ? 'opacity-50' : ''}`}
      onClick={(e) => {
        if (!imageId || (e.target as HTMLElement).closest('input,textarea,button,a,form')) return;
        goto({ versionId, commentId, imageId });
      }}
    >
      {children}
    </div>
  );
}
