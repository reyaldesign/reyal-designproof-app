'use client';

import { useEffect, useRef, useState } from 'react';
import './live.css';

/** A Figma prototype in Figma's own embed. Figma reports which screen is showing (PRESENTED_NODE_CHANGED), so the review page knows which screen a comment belongs to. */
export default function FigmaStage({ src, width, onNode }: { src: string; width: number | null; onNode: (node: string) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setLoaded(false);
    const on = (e: MessageEvent) => {
      if (e.origin !== 'https://www.figma.com' || e.source !== frame.current?.contentWindow) return;
      const m = e.data as { type?: string; data?: { presentedNodeId?: string } } | null;
      if (m?.type === 'INITIAL_LOAD') setLoaded(true);
      if (m?.type === 'PRESENTED_NODE_CHANGED') {
        setLoaded(true);
        const id = m.data?.presentedNodeId;
        if (typeof id === 'string' && /^\d+:\d+$/.test(id)) onNode(id);
      }
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, [src, onNode]);
  return (
    <div className="lv" style={{ position: 'absolute', inset: 0 }}>
      <div className="lv-view">
        <div className="lv-frame" style={{ width: width ? `min(${width}px, 100%)` : '100%' }}>
          <iframe ref={frame} key={src} src={src} title="Figma prototype" allow="fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setLoaded(true)} />
        </div>
        {!loaded && <div className="lv-note" role="status"><b>Loading the prototype…</b><span>This can take a few seconds the first time.</span></div>}
      </div>
    </div>
  );
}
