'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { DEVICES, pathOf, samePage, type Device } from '@/lib/live';
import './live.css';

export type LivePin = { id: string; n: number | string; kind: 'open' | 'done' | 'draft' | 'new'; selector?: string | null; rx?: number | null; ry?: number | null; x?: number | null; y?: number | null; href: string; device?: string | null; sel?: boolean };
export type LivePick = {
  selector: string; text: string; rx: number; ry: number; x: number; y: number; vw: number; device: Device; href: string;
  rect: { l: number; t: number; w: number; h: number };
  /** Where to put a box beside the pick, in this component's own coordinates. */
  at: { left: number; top: number; width: number; height: number };
};
export type LiveHandle = { capture: (id: string, rect?: LivePick['rect']) => void; clear: () => void; open: (href: string, id?: string, device?: string | null) => void };
type Props = {
  url: string;
  pins: LivePin[];
  /** No picking: the admin view, or an approved version. */
  readOnly?: boolean;
  focusId?: string | null;
  onPick?: (p: LivePick) => void;
  onPinClick?: (id: string) => void;
  onShot?: (id: string, dataUrl: string | null) => void;
  onBridge?: (state: 'waiting' | 'ready' | 'missing') => void;
  onMode?: (mode: 'comment' | 'browse') => void;
  children?: React.ReactNode;
};

const touch = () => typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;

/** A live website in an iframe, with Desktop / Tablet / Phone sizes and a Sections list. Picking and pins come from the Review Bridge running inside the site. */
const LiveStage = forwardRef<LiveHandle, Props>(function LiveStage({ url, pins, readOnly, focusId, onPick, onPinClick, onShot, onBridge, onMode, children }, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<Device>('desktop');
  const [mode, setMode] = useState<'comment' | 'browse'>(readOnly ? 'browse' : 'comment');
  const [bridge, setBridge] = useState<'waiting' | 'ready' | 'missing'>('waiting');
  const [page, setPage] = useState(url);
  const [sections, setSections] = useState<{ i: number; name: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const pending = useRef<string | null>(null); // a pin to scroll to once another page has loaded

  // "Desktop" on a phone still shows that screen's layout, so a comment is filed under the size actually shown.
  const effective = useCallback((): Device => {
    if (device !== 'desktop' || typeof window === 'undefined') return device; // on the server there is no screen yet
    const w = frame.current?.clientWidth || window.innerWidth;
    return w < 600 ? 'mobile' : w < 1024 && touch() ? 'tablet' : 'desktop';
  }, [device]);

  const send = useCallback((m: Record<string, unknown>) => {
    let origin = '*';
    try { origin = new URL(page).origin; } catch { /* keep any */ }
    frame.current?.contentWindow?.postMessage({ rs: 1, ...m }, origin); // only the site that was opened gets the pins and commands
  }, [page]);

  useImperativeHandle(ref, () => ({
    capture: (id, rect) => send({ type: 'capture', id, rect }),
    clear: () => send({ type: 'clear' }),
    // Show a comment: the same page just scrolls to its pin, another page is opened first.
    open: (href, id, dev) => {
      if (dev === 'desktop' || dev === 'tablet' || dev === 'mobile') setDevice(dev); // a comment is shown at the size it was made on
      if (samePage(page, href)) { if (id) setTimeout(() => send({ type: 'focus', id }), dev && dev !== device ? 500 : 0); return; }
      pending.current = id ?? null;
      if (frame.current) frame.current.src = href;
    },
  }), [send, page]);

  const shown = pins.filter((p) => !p.device || p.device === effective());
  const pinsJson = JSON.stringify(shown);

  // keep the bridge in step
  useEffect(() => { if (bridge === 'ready') send({ type: 'mode', mode: readOnly ? 'browse' : mode }); }, [mode, readOnly, bridge, send]);
  useEffect(() => { if (bridge === 'ready') send({ type: 'pins', items: JSON.parse(pinsJson) }); }, [pinsJson, bridge, send, page]);
  useEffect(() => { if (bridge === 'ready' && focusId) send({ type: 'focus', id: focusId }); }, [focusId, bridge, send]);
  useEffect(() => { onBridge?.(bridge); }, [bridge, onBridge]);
  useEffect(() => { onMode?.(readOnly ? 'browse' : mode); }, [mode, readOnly, onMode]);

  // no hello soon after the page loads means the site has no bridge (or refuses to be shown)
  useEffect(() => {
    setBridge('waiting');
    if (!loaded) return;
    const t = setTimeout(() => setBridge((b) => (b === 'waiting' ? 'missing' : b)), 6000);
    return () => clearTimeout(t);
  }, [loaded, url]);
  useEffect(() => { const t = setTimeout(() => setBridge((b) => (b === 'waiting' ? 'missing' : b)), 15000); return () => clearTimeout(t); }, [url]);

  useEffect(() => {
    const on = (e: MessageEvent) => {
      const m = e.data as { rs?: number; type?: string; [k: string]: unknown } | null;
      if (!m || m.rs !== 1 || e.source !== frame.current?.contentWindow) return;
      if (m.type === 'hello') {
        setBridge('ready');
        setPage(String(m.href || url));
        setSections(Array.isArray(m.sections) ? (m.sections as { i: number; name: string }[]) : []);
        if (pending.current) { const id = pending.current; pending.current = null; const o = (() => { try { return new URL(String(m.href)).origin; } catch { return '*'; } })(); setTimeout(() => frame.current?.contentWindow?.postMessage({ rs: 1, type: 'focus', id }, o), 700); }
      } else if (m.type === 'pick' && onPick && !readOnly) {
        const r = m.rect as LivePick['rect'];
        const f = frame.current!.getBoundingClientRect(), b = box.current!.getBoundingClientRect();
        onPick({
          selector: String(m.selector || ''), text: String(m.text || ''), rx: Number(m.rx), ry: Number(m.ry), x: Number(m.x), y: Number(m.y),
          vw: Number(m.vw), device: effective(), href: String(m.href || page), rect: r,
          at: { left: f.left - b.left + r.l, top: f.top - b.top + r.t, width: r.w, height: r.h },
        });
      } else if (m.type === 'pinclick') onPinClick?.(String(m.id));
      else if (m.type === 'shot') onShot?.(String(m.id), typeof m.dataUrl === 'string' ? m.dataUrl : null);
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, [url, page, onPick, onPinClick, onShot, readOnly, effective]);

  const width = DEVICES.find((d) => d.key === device)?.width;
  return (
    <div className="lv" ref={box}>
      <div className="lv-bar">
        <select className="lv-sections" aria-label="Sections" disabled={!sections.length} value="" onChange={(e) => { if (e.target.value !== '') send({ type: 'section', i: Number(e.target.value) }); }}>
          <option value="">Sections</option>
          {sections.map((s) => <option key={s.i} value={s.i}>{s.name}</option>)}
        </select>
        <div className="lv-seg" role="group" aria-label="Screen size">
          {DEVICES.map((d) => <button key={d.key} className={device === d.key ? 'on' : ''} onClick={() => setDevice(d.key)}>{d.label}</button>)}
        </div>
        {!readOnly && (
          <div className="lv-seg" role="group" aria-label="Mode">
            <button className={mode === 'comment' ? 'on' : ''} onClick={() => setMode('comment')} disabled={bridge !== 'ready'}>Comment</button>
            <button className={mode === 'browse' ? 'on' : ''} onClick={() => setMode('browse')}>Browse</button>
          </div>
        )}
        <a className="lv-open" href={page} target="_blank" rel="noreferrer" title={page}>{pathOf(page)} ↗</a>
      </div>
      <div className="lv-view">
        <div className="lv-frame" style={{ width: width ? `min(${width}px, 100%)` : '100%' }}>
          <iframe ref={frame} src={url} title="Website" onLoad={() => { setLoaded(true); send({ type: 'ping' }); }} allow="fullscreen" referrerPolicy="strict-origin-when-cross-origin" />
        </div>
        {bridge === 'missing' && (
          <div className="lv-note" role="status">
            <b>Comments on the page are not available yet.</b>
            <span>The site needs the Reyal Review Bridge to take pinned comments. You can still look around in each size and add general comments. If the site does not show at all, it may block being displayed here.</span>
          </div>
        )}
        {children}
      </div>
    </div>
  );
});
export default LiveStage;
