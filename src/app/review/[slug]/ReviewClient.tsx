'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import FigmaStage from '@/components/FigmaStage';
import Tour, { type TourStep } from '@/components/Tour';
import LiveStage, { type LiveHandle, type LivePick, type LivePin } from '@/components/LiveStage';
import { DEVICES, pathOf, type Device } from '@/lib/live';
import '../figma-review.css';
import { ApproveDialog, FinalRoundDialog, GuardDialog, PagesList, ProgressCard, RoundBar, SendDialog, SuccessScreen, type PageState } from './FigmaParts';

type C = {
  id: string; imageId: string | null; parentId: string | null; author: string; text: string;
  x: number | null; y: number | null; pin: number | null; resolved: boolean; fromDesigner: boolean; createdAt: string;
  round?: number | null; // the revision it was sent in
  // live website comments
  pageUrl?: string | null; selector?: string | null; elementText?: string | null; rx?: number | null; ry?: number | null; vw?: number | null; device?: string | null; shot?: string | null;
};
type LiveDraft = { pageUrl: string; selector: string; elementText: string; rx: number; ry: number; vw: number; device: Device; shot: string | null; rect: LivePick['rect'] };
type Draft = { tid: string; imageId: string | null; x: number | null; y: number | null; text: string; live?: LiveDraft };
type Props = {
  slug: string; title: string; client: string; status: string;
  approval: { by: string; at: string; version: number } | null; latest: number;
  revisions: { used: number; included: number };
  versions: { number: number; label: string }[];
  current: { id: string; number: number; label: string };
  images: Img[];
  comments: C[];
  live: string | null; // the address of a live website being reviewed in place of images
  figma: { links: Record<string, { embed: string; start: string | null; name: string; pages: { id: string; name: string; w: number; h: number }[] }> } | null; // a Figma prototype, one link per screen size
  figmaMissing: boolean; // the proof has Figma links but this server is not set up for them
};
type Img = { id: string; file: string; frameId?: string | null; frameName?: string | null; device?: string | null; fw?: number | null; fh?: number | null };

const store = {
  get: (k: string) => { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};
const uid = () => Math.random().toString(36).slice(2, 10);
const when = (iso: string) => (Date.now() - new Date(iso).getTime() < 60_000 ? 'Just now' : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
const plural = (n: number) => `${n} comment${n === 1 ? '' : 's'}`;
// A comment needs a real word: at least 2 characters with a letter or digit in it, so a lone "." is not saved.
const real = (t: string) => t.trim().length >= 2 && /[\p{L}\p{N}]/u.test(t);

// Kept outside the main component so its identity is stable and the pop-in animation only plays when a pin first appears.
function Pin({ n, kind, x, y, scale, onClick }: { n: number | string; kind: 'open' | 'done' | 'draft' | 'new'; x: number; y: number; scale: number; onClick?: () => void }) {
  return (
    <div className="rv-pinwrap" style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) scale(${1 / scale})` }}>
      <span className={`rv-pin ${kind}`} onPointerUp={(e) => e.stopPropagation()} onClick={onClick} role="button" aria-label={`Comment ${n}`}>{n}</span>
    </div>
  );
}

export default function ReviewClient({ slug, title, client, status, approval, latest, revisions, versions, current, images: savedImages, comments, live, figma, figmaMissing }: Props) {
  const router = useRouter();
  const draftKey = `rp:draft:${current.id}`;
  const [tab, setTab] = useState<'send' | 'sent'>('send');
  const [guideHidden, setGuideHidden] = useState<boolean | null>(null);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [terms, setTerms] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [agree, setAgree] = useState(false);
  const [aname, setAname] = useState('');
  const [aerr, setAerr] = useState('');
  const [abusy, setAbusy] = useState(false);
  const [idx, setIdx] = useState(0);
  const [scale, setScale] = useState(1);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [general, setGeneral] = useState('');
  const [pop, setPop] = useState<{ tid: string; left: number; top: number; flip: boolean } | null>(null);
  const [popText, setPopText] = useState('');
  const [popErr, setPopErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  // Figma prototype: the size shown, Browse (click through the prototype) or Comment (pin a note on the screen as an image), and the screen on show.
  const [extra, setExtra] = useState<Img[]>([]); // screens exported from Figma since the page loaded
  const images: Img[] = [...savedImages, ...extra.filter((e) => !savedImages.some((i) => i.id === e.id))];
  const figDevices = figma ? DEVICES.filter((d) => figma.links[d.key]) : [];
  const [figDevice, setFigDevice] = useState<Device>((figDevices[0]?.key ?? 'desktop') as Device);
  const [figMode, setFigMode] = useState<'browse' | 'comment'>('comment'); // opens on the screen, ready to comment; Preview is one click away
  const [figNode, setFigNode] = useState<string | null>(null);
  const [figBusy, setFigBusy] = useState(false);
  const [figErr, setFigErr] = useState('');
  const [pager, setPager] = useState(false); // the list of screens, opened from the corner of the design
  const [tourOpen, setTourOpen] = useState(false);
  // Figma website proofs: the pages marked Looks good, kept per version in this browser until the round is sent.
  const [marks, setMarks] = useState<string[]>([]);
  const [panelTab, setPanelTab] = useState<'pages' | 'comments'>('pages');
  const [guard, setGuard] = useState(false); // some pages have nothing on them: ask before sending
  const [whole, setWhole] = useState(''); // an optional note for the whole site, written in the send box
  const [success, setSuccess] = useState<{ kind: 'sent' | 'approved'; comments: number; pages: number; round: number } | null>(null);
  const [finalIntro, setFinalIntro] = useState(false); // the pop-up the first time the final round is opened
  const [toast, setToast] = useState<{ msg: string; action?: { label: string; run: () => void } } | null>(null);
  const [sentOpen, setSentOpen] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null); // the "Click to comment" tag that follows the pointer
  const scrollRef = useRef<HTMLDivElement>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const tw = useRef<ReactZoomPanPinchRef>(null);
  const liveRef = useRef<LiveHandle>(null);
  const down = useRef({ x: 0, y: 0 });

  const img = images[idx];
  const showImg = !live && (!figma || figMode === 'comment'); // the image stage with pins
  const locked = approval?.version === current.number; // approved versions take no more comments
  const canApprove = !approval && current.number === latest;
  const nextRev = revisions.used + 1; // the revision this Send revision would use
  const outOfRevisions = revisions.used >= revisions.included;
  const sendable = drafts.filter((d) => d.text);
  const unsent = sendable.length;
  const roots = comments.filter((c) => !c.parentId);
  const maxPin = Math.max(0, ...roots.map((c) => c.pin ?? 0));
  // A pin takes the next number only once it has text (the one being typed counts too). A click that was abandoned never uses one up.
  const pinned = drafts.filter((d) => d.x != null && (d.text || d.tid === pop?.tid));
  const draftPin = (tid: string) => maxPin + pinned.findIndex((d) => d.tid === tid) + 1;
  const isLatest = current.number === latest;
  const versionName = `Version ${current.number}${current.label && !/^(v|version)\s*\d+$/i.test(current.label.trim()) ? ` · ${current.label.trim()}` : ''}`;
  const waiting = status === 'Feedback Received' && isLatest;
  const pill = locked ? { cls: 'ok', long: 'Approved', short: 'Approved' }
    : lastSent || waiting ? { cls: 'sent', long: 'Revision sent · Reyal is working on it', short: 'Sent' }
    : { cls: 'wait', long: 'Waiting for your review', short: 'Your review' };

  useEffect(() => {
    setName(store.get('rp:name'));
    setGuideHidden(store.get('rp:guide') === 'hidden');
    try { setDrafts(JSON.parse(store.get(draftKey) || '[]')); } catch { setDrafts([]); }
    setReady(true);
  }, [draftKey]);
  useEffect(() => { if (ready) store.set(draftKey, JSON.stringify(drafts)); }, [drafts, ready, draftKey]);
  // A click with no comment typed is dropped as soon as the person moves on (another click, another page, closing the box).
  useEffect(() => { setDrafts((d) => (d.some((x) => !x.text && x.tid !== pop?.tid) ? d.filter((x) => x.text || x.tid === pop?.tid) : d)); }, [pop?.tid]);
  const marksKey = `rp:marks:${current.id}`;
  useEffect(() => { try { const m = JSON.parse(store.get(marksKey) || '[]'); setMarks(Array.isArray(m) ? m.filter((x: unknown) => typeof x === 'string') : []); } catch { setMarks([]); } }, [marksKey]);
  useEffect(() => { if (ready) store.set(marksKey, JSON.stringify(marks)); }, [marks, ready, marksKey]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setPop(null);
    if (!img) return;
    setNat(null);
    const i = new Image();
    i.onload = () => setNat({ w: i.naturalWidth, h: i.naturalHeight });
    i.src = `/files/${img.file}`;
  }, [img?.file]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName) || confirmSend || terms || figma) return;
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(images.length - 1, i + 1));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [images.length, confirmSend, terms]);

  const tall = !!nat && nat.h / nat.w > 2.2; // a long web page: fit the width and scroll down it, not shrink it to fit the height
  const fit = nat && stage.w ? (tall ? Math.min((stage.w - 48) / nat.w, 1) : Math.min((stage.w - 48) / nat.w, (stage.h - 48) / nat.h, 1)) : 0;
  const size = nat && fit ? { width: Math.round(nat.w * fit), height: Math.round(nat.h * fit) } : null;


  // On a long page the wheel scrolls down it (zoom stays on the + and - buttons).
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !tall || !size) return;
    const on = (e: WheelEvent) => {
      const t = tw.current;
      if (!t) return;
      e.preventDefault();
      const st = t.state;
      if (!st) return;
      const minY = Math.min(0, stage.h - (size.height + 48) * st.scale);
      t.setTransform(st.positionX, Math.max(minY, Math.min(0, st.positionY - e.deltaY)), st.scale, 0);
    };
    el.addEventListener('wheel', on, { passive: false });
    return () => el.removeEventListener('wheel', on);
  }, [tall, size?.height, stage.h, showImg]); // eslint-disable-line react-hooks/exhaustive-deps

  function place(e: React.PointerEvent) {
    if (locked || (figma && figDevice !== 'desktop') || !imgRef.current || !canvasRef.current) return;
    if (Math.hypot(e.clientX - down.current.x, e.clientY - down.current.y) > 6) return; // it was a pan, not a tap
    const r = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    const s = canvasRef.current.getBoundingClientRect();
    const tid = uid();
    setDrafts((d) => [...d, { tid, imageId: img.id, x, y, text: '' }]);
    setPopText('');
    setPopErr('');
    setLastSent(null);
    setTab('send');
    setPanelTab('comments');
    setPop({ tid, left: e.clientX - s.left, top: e.clientY - s.top, flip: x > 55 });
  }
  function closePop(save: boolean) {
    if (!pop) return;
    liveRef.current?.clear();
    const text = popText.trim();
    if (save && !real(text)) { setPopErr(text ? 'Please write a little more, so we know what to change.' : 'Write what should change before you add the comment.'); return; }
    setPopErr('');
    setDrafts((d) => (save && text ? d.map((x) => (x.tid === pop.tid ? { ...x, text } : x)) : d.filter((x) => x.tid !== pop.tid)));
    setPop(null);
  }
  function addGeneral() {
    const text = general.trim();
    if (!real(text)) return;
    setDrafts((d) => [...d, { tid: uid(), imageId: null, x: null, y: null, text }]);
    setGeneral('');
    setLastSent(null);
  }
  const goPage = (i: number) => {
    setIdx(i); setPop(null);
    const m = images[i];
    if (figma && m?.device && figma.links[m.device]) { setFigDevice(m.device as Device); setFigMode('comment'); }
  };
  // Figma proofs name a screen by its size and its own name: "Phone · Choose location".
  const shortName = (n: string | null | undefined) => (n ?? '').replace(/^\[[^\]]*\]\s*/, '').replace(/\s*\/\s*(Desktop|Tablet|Mobile|Phone)\b.*$/i, '').trim();
  const viewLabel = (i: number) => {
    const m = images[i];
    const dev = DEVICES.find((d) => d.key === m?.device)?.label;
    const name = shortName(m?.frameName);
    return dev ? (name ? `${dev} · ${name}` : dev) : `Screen ${i + 1}`;
  };
  const pageLabel = (imageId: string | null) => {
    const i = images.findIndex((m) => m.id === imageId);
    if (figma) return i >= 0 ? viewLabel(i) : 'General';
    return `Page ${i + 1}`;
  };
  // Show one screen of the prototype as an image to comment on. A screen is exported from Figma the first time it is needed.
  async function showFrame(node: string | null, device: Device) {
    if (!figma || !node) return;
    setFigErr('');
    const have = images.findIndex((m) => m.frameId === node);
    if (have >= 0) { setIdx(have); setPop(null); setFigMode('comment'); return; }
    setFigBusy(true);
    const r = await fetch(`/api/review/${slug}/figma-frame`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ versionId: current.id, node, device }) }).catch(() => null);
    const j = r ? ((await r.json().catch(() => null)) as { image?: Img; error?: string } | null) : null;
    setFigBusy(false);
    if (!r?.ok || !j?.image) return setFigErr(j?.error || 'Could not load this screen from Figma. Check your connection and try again.');
    const image = j.image;
    setExtra((x) => (x.some((e) => e.id === image.id) ? x : [...x, image]));
    setIdx(images.some((m) => m.id === image.id) ? images.findIndex((m) => m.id === image.id) : images.length);
    setPop(null);
    setFigMode('comment');
  }
  // Comment mode shows the screen being reviewed; Preview opens the prototype of that same size, at that screen.
  const figComment = () => showFrame(figNode ?? figma?.links[figDevice]?.start ?? null, figDevice);
  const allPages = figma ? DEVICES.flatMap((d) => (figma.links[d.key]?.pages ?? []).map((p) => ({ device: d.key, size: d.label, id: p.id, name: shortName(p.name) || d.label }))) : [];
  // A page is done when it has a comment or was marked Looks good. Only Desktop counts: Phone and Tablet are for previewing.
  const primary = (figma?.links.desktop ? 'desktop' : figDevices[0]?.key ?? 'desktop') as Device;
  const draftsOn = (frameId: string) => { const m = images.find((i) => i.frameId === frameId); return m ? drafts.filter((d) => d.text && d.imageId === m.id && d.x != null).length : 0; };
  const pageStates: PageState[] = (figma?.links[primary]?.pages ?? []).map((p) => ({ id: p.id, name: shortName(p.name) || 'Page', comments: draftsOn(p.id), good: marks.includes(p.id) }));
  const doneCount = pageStates.filter((p) => p.comments > 0 || p.good).length;
  const openPages = pageStates.filter((p) => p.comments === 0 && !p.good);
  // Screens still being fetched from Figma: look again every few seconds until they have all arrived.
  const missing = figma ? allPages.filter((p) => !images.some((m) => m.frameId === p.id)).length : 0;
  useEffect(() => {
    if (!missing) return;
    let n = 0;
    const t = setInterval(() => { if (++n > 80) clearInterval(t); else router.refresh(); }, 12_000);
    return () => clearInterval(t);
  }, [missing]); // eslint-disable-line react-hooks/exhaustive-deps
  const goTo = (p: { device: Device; id: string }) => { setGuard(false); setConfirmSend(false); setTerms(false); setFigDevice(p.device); setFigErr(''); setPop(null); setPager(false); void showFrame(p.id, p.device); };
  const previewSrc = (() => {
    const link = figma?.links[figDevice];
    if (!link) return '';
    const node = img?.device === figDevice && img.frameId ? img.frameId : link.start;
    const u = new URL(link.embed);
    if (node && node !== link.start) { u.searchParams.set('node-id', node.replace(':', '-')); u.searchParams.set('starting-point-node-id', node); }
    // Figma draws a phone inside a phone-shaped frame and shrinks all of it to fit the height, which makes the screen small. Fitting the width makes it larger.
    if (figDevice === 'mobile') u.searchParams.set('scaling', 'scale-down-width');
    return u.toString();
  })();
  // As the client clicks through the prototype, each screen is fetched from Figma in the background, so Comment is usually ready at once.
  useEffect(() => {
    if (!figma || !figNode || figMode !== 'browse' || images.some((m) => m.frameId === figNode)) return;
    let on = true;
    fetch(`/api/review/${slug}/figma-frame`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ versionId: current.id, node: figNode, device: figDevice }) })
      .then((r) => r.json()).then((j: { image?: Img }) => { const image = j.image; if (on && image) setExtra((x) => (x.some((e) => e.id === image.id) ? x : [...x, image])); })
      .catch(() => {});
    return () => { on = false; };
  }, [figNode, figDevice, figMode]); // eslint-disable-line react-hooks/exhaustive-deps
  function figSize(d: Device) {
    setFigDevice(d); setFigNode(null); setFigErr(''); setPop(null);
    if (figMode === 'comment') void showFrame(figma?.links[d]?.start ?? null, d);
  }
  // Open on the first size's starting screen, ready to comment.
  useEffect(() => { if (figma) void showFrame(figma.links[figDevice]?.start ?? null, figDevice); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- live website: a pick inside the site starts a draft, and its screenshot is uploaded as soon as it arrives -----
  const [focus, setFocus] = useState<string | null>(null);
  const [bridge, setBridge] = useState<'waiting' | 'ready' | 'missing'>('waiting');
  const [liveMode, setLiveMode] = useState<'comment' | 'browse'>('comment');
  function livePick(p: LivePick) {
    if (locked) return;
    const tid = uid();
    setDrafts((d) => [...d, { tid, imageId: null, x: p.x, y: p.y, text: '', live: { pageUrl: p.href, selector: p.selector, elementText: p.text, rx: p.rx, ry: p.ry, vw: p.vw, device: p.device, shot: null, rect: p.rect } }]);
    setPopText('');
    setPopErr('');
    setLastSent(null);
    setTab('send');
    const right = p.at.left + p.at.width + 330 < stage.w;
    setPop({ tid, left: right ? p.at.left + p.at.width - 8 : p.at.left + 8, top: p.at.top, flip: !right });
    liveRef.current?.capture(tid, p.rect);
  }
  async function liveShot(tid: string, dataUrl: string | null) {
    if (!dataUrl) return;
    const r = await fetch(`/api/review/${slug}/shot`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl }) }).catch(() => null);
    const name = r?.ok ? ((await r.json().catch(() => null)) as { name?: string } | null)?.name : null;
    if (name) setDrafts((d) => d.map((x) => (x.tid === tid && x.live ? { ...x, live: { ...x.live, shot: name } } : x)));
  }
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string, action?: { label: string; run: () => void }) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, action });
    toastTimer.current = setTimeout(() => setToast(null), 7000);
  }
  function drop(tid: string) {
    const gone = drafts.find((y) => y.tid === tid);
    setDrafts((x) => x.filter((y) => y.tid !== tid));
    if (gone) showToast('Comment deleted.', { label: 'Undo', run: () => { setDrafts((x) => (x.some((y) => y.tid === tid) ? x : [...x, gone])); setToast(null); } });
  }

  async function send() {
    setBusy(true); setErr('');
    store.set('rp:name', name);
    const note = whole.trim();
    const ordered = [...pinned, ...drafts.filter((d) => d.x == null), ...(figma && real(note) ? [{ tid: uid(), imageId: null, x: null, y: null, text: note } as Draft] : [])].filter((d) => d.text);
    const r = await fetch(`/api/review/${slug}/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versionId: current.id, name, comments: ordered.map((d) => (d.live ? { text: d.text, x: d.x, y: d.y, ...d.live, rect: undefined } : d)), confirmed: true, marks: figma ? pageStates.filter((p) => p.good && !p.comments).map((p) => ({ id: p.id, name: p.name, device: primary })) : undefined }),
    }).catch(() => null);
    setBusy(false);
    setConfirmSend(false);
    if (!r?.ok) {
      const msg = ((await r?.json().catch(() => null)) as { error?: string } | null)?.error;
      return setErr(msg || 'Could not send. Check your connection and try again. Your comments are saved.');
    }
    setDrafts([]);
    setMarks([]);
    setWhole('');
    setLastSent(`Revision ${nextRev} sent · ${plural(ordered.length)}`);
    setTab('sent');
    if (figma) setSuccess({ kind: 'sent', comments: ordered.length, pages: new Set(ordered.filter((d) => d.imageId).map((d) => d.imageId)).size, round: nextRev });
    router.refresh();
  }
  // Sending asks first when some pages have nothing on them, and never blocks.
  function startSend() { setWhole(''); if (figma && openPages.length) setGuard(true); else setConfirmSend(true); }
  const toggleGood = (id: string) => setMarks((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  function openTerms() {
    setAname(name);
    setAgree(false);
    setAerr('');
    setTerms(true);
  }
  async function approve() {
    setAbusy(true); setAerr('');
    const r = await fetch(`/api/review/${slug}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: aname, agreed: agree, versionNumber: current.number }),
    }).catch(() => null);
    setAbusy(false);
    if (!r?.ok) return setAerr(((await r?.json().catch(() => null)) as { error?: string } | null)?.error || 'Could not approve. Please try again.');
    store.set('rp:name', aname);
    setName(aname);
    setDrafts([]); // unsent comments are discarded when a version is approved
    setPop(null);
    setTerms(false);
    if (figma) setSuccess({ kind: 'approved', comments: 0, pages: 0, round: revisions.used });
    router.refresh();
  }
  // The guided tour of a Figma proof: five steps, shown the first time in a browser. Quick tour in the header plays it again.
  const tourSteps: TourStep[] = [
    { target: '', next: 'Start tour', title: 'Welcome to your website review', body: `You're looking at ${versionName}${isLatest ? ', the latest' : ''}. Here's a quick look at how it works. Best viewed on a laptop or desktop.` },
    { target: '[data-tour="sizes"]', place: 'bottom', title: 'Check all three sizes', body: 'Switch between Desktop, Phone and Tablet. Comments on Desktop apply to the other sizes too, so only comment on Desktop.' },
    { target: '[data-tour="design"]', place: 'inside', title: 'Click to leave a comment', body: 'Click anywhere on the page to leave a comment. Say what you\'d like changed. Your comments collect on the right.' },
    { target: '[data-tour="pager"]', place: 'bottom', title: 'Go through every page', body: 'Use the arrows to change pages. Comment on any page that needs a change, or tap Looks good. We keep count so nothing gets missed.' },
    { target: '[data-tour="actions"]', place: 'left', next: 'Start reviewing', title: 'Send or approve', body: 'When you\'re done, send your comments as one revision. If the website is final, approve it instead. Only the latest version can be approved.' },
  ];
  useEffect(() => {
    if (!figma || !ready) return;
    if (!['seen', 'never'].includes(store.get('rp:tour:figma'))) { const t = setTimeout(() => setTourOpen(true), 900); return () => clearTimeout(t); }
  }, [figma, ready]);
  const closeTour = (done: boolean) => {
    setTourOpen(false);
    store.set('rp:tour:figma', 'seen');
    if (!done) showToast('Tour skipped. Replay it anytime from Quick tour.', { label: 'Replay now', run: () => { setToast(null); setTourOpen(true); } });
  };
  // The first time the last round is opened, say so once.
  const roundNo = Math.min(nextRev, revisions.included);
  const finalRound = !!figma && !locked && isLatest && !waiting && !outOfRevisions && revisions.included > 1 && nextRev >= revisions.included;
  useEffect(() => { if (finalRound && ready && store.get(`rp:final:${slug}:${nextRev}`) !== '1') setFinalIntro(true); }, [finalRound, ready, slug, nextRev]);
  const dismissGuide = (hide: boolean) => { setGuideHidden(hide); store.set('rp:guide', hide ? 'hidden' : 'shown'); };

  const sentHere = roots.filter((c) => c.imageId === img?.id && c.x != null);
  const draftsHere = drafts.filter((d) => d.imageId === img?.id && d.text);
  const newDraft = pop ? drafts.find((d) => d.tid === pop.tid) : undefined;
  const pageCount = (id: string) => roots.filter((c) => c.imageId === id && c.x != null).length + drafts.filter((d) => d.imageId === id && d.x != null && d.text).length;
  const livePins: LivePin[] = !live ? [] : [
    ...roots.filter((c) => c.pageUrl && c.pin != null).map((c): LivePin => ({ id: c.id, n: c.pin!, kind: c.resolved ? 'done' : 'open', selector: c.selector, rx: c.rx, ry: c.ry, x: c.x, y: c.y, href: c.pageUrl!, device: c.device, sel: c.id === focus })),
    ...drafts.filter((d) => d.live && d.text && d.tid !== pop?.tid).map((d): LivePin => ({ id: d.tid, n: draftPin(d.tid), kind: 'draft', selector: d.live!.selector, rx: d.live!.rx, ry: d.live!.ry, x: d.x, y: d.y, href: d.live!.pageUrl, device: d.live!.device })),
    ...(newDraft?.live ? [{ id: newDraft.tid, n: draftPin(newDraft.tid), kind: 'new' as const, selector: newDraft.live.selector, rx: newDraft.live.rx, ry: newDraft.live.ry, x: newDraft.x, y: newDraft.y, href: newDraft.live.pageUrl, device: newDraft.live.device }] : []),
  ];
  const segs = Array.from({ length: Math.min(revisions.included, 12) }, (_, k) => (k < revisions.used ? (outOfRevisions ? 'full' : 'used') : ''));
  const revLabel = `${Math.min(revisions.used, revisions.included)} of ${revisions.included} revisions used`;

  // ----- pieces shared by the desktop panel and the mobile sheet -----
  const tabs = (
    <div className="rv-tabs" role="tablist">
      {([['send', 'Ready to send', unsent], ['sent', 'Sent', roots.length]] as const).map(([k, label, n]) => (
        <button key={k} role="tab" aria-selected={tab === k} className={`rv-tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{label}<span className="c">{n}</span></button>
      ))}
    </div>
  );

  const sentCard = (c: C) => {
    const replies = comments.filter((r) => r.parentId === c.id);
    const page = live ? (c.pageUrl ? 0 : -1) : images.findIndex((m) => m.id === c.imageId);
    const st = c.resolved ? { cls: 'done', label: 'Done' } : replies.length ? { cls: 'replied', label: 'Replied' } : { cls: 'with', label: 'With Reyal' };
    const open = () => { if (live && c.pageUrl) { setFocus(c.id); liveRef.current?.open(c.pageUrl, c.id, c.device); } else if (page >= 0) goPage(page); };
    return (
      <div key={c.id} className={`rv-sent ${page >= 0 ? 'go' : ''}`} role={page >= 0 ? 'button' : undefined} tabIndex={page >= 0 ? 0 : undefined}
        onClick={open} onKeyDown={(e) => { if (e.key === 'Enter') open(); }}>
        <div className="meta">
          <span className={`rv-pinpill ${c.resolved ? 'done' : ''}`}>{c.pin ?? '•'}</span>
          <span className="who">{c.author}</span>
          <span>{live ? (c.pageUrl ? `${pathOf(c.pageUrl)}${c.device ? ` · ${c.device}` : ''}` : 'General') : page >= 0 ? pageLabel(c.imageId) : figma ? 'Whole site' : 'General'} · {when(c.createdAt)}</span>
          <span className={`rv-chip ${st.cls}`}>{st.label}</span>
        </div>
        {c.elementText && <span className="rv-where">On “{c.elementText.slice(0, 80)}”</span>}
        <span className="rv-text">{c.text}</span>
        {replies.map((r) => (
          <div key={r.id} className="rv-reply">
            <span className="av">R</span>
            <div><b>Reyal Design</b><span className="t">{r.text}</span></div>
          </div>
        ))}
      </div>
    );
  };
  const readyList = (
    <>
      {locked && (
        <div className="rv-banner" style={{ background: 'rgba(61,220,151,.1)' }}>
          <b>Approved by {approval!.by}</b><span>This version is final and closed to comments.</span>
        </div>
      )}
      {!unsent && !locked && (
        <div className="rv-empty">
          <b>{lastSent && !figma ? 'All sent' : 'No comments yet'}</b>
          <span>{lastSent && !figma ? 'Comments you add now go into the next revision.' : figma ? 'Click anywhere on the page to leave a comment.' : 'Click anywhere on the design to pin one.'}</span>
        </div>
      )}
      {sendable.map((d) => (
        <div key={d.tid} className="rv-draft">
          <div className="meta">
            <span className="rv-num">{d.x == null ? (figma ? 'W' : 'G') : draftPin(d.tid)}</span>
            <span>{d.x == null ? (figma ? 'Whole site · not sent yet' : 'General · not sent') : d.live ? `${pathOf(d.live.pageUrl)} · ${d.live.device} · not sent` : `${pageLabel(d.imageId)} · not sent`}</span>
            <button className="rm" onClick={() => drop(d.tid)} aria-label="Delete comment">Delete</button>
          </div>
          {d.live?.elementText && <span className="rv-where">On “{d.live.elementText.slice(0, 80)}”</span>}
          <span className="rv-text">{d.text}</span>
        </div>
      ))}
      {!locked && !figma && (
        <div className="rv-general">
          <input className="rv-pill-field" value={general} onChange={(e) => setGeneral(e.target.value)} placeholder="Add a general comment" aria-label="General comment" onKeyDown={(e) => { if (e.key === 'Enter') addGeneral(); }} />
          <button className="rv-ghost" onClick={addGeneral}>Add</button>
        </div>
      )}
    </>
  );
  const list = tab === 'send' ? (
    <div className="rv-list">{readyList}</div>
  ) : (
    <div className="rv-list">
      {!roots.length && <div className="rv-empty"><b>Nothing sent yet</b><span>Comments you send show up here, with replies from Reyal Design.</span></div>}
      {roots.map(sentCard)}
    </div>
  );

  const foot = (
    <div className="rv-foot">
      {lastSent && (
        <div className="rv-banner" role="status">
          <b>{lastSent}</b>
          <span>Reyal Design has been notified. You&apos;ll get an email when the next version is ready.</span>
        </div>
      )}
      {!locked && (
        <>
          <div className="rv-meter">
            <span>Revisions</span>
            <span className="segs">{segs.map((s, k) => <span key={k} className={`seg ${s}`} />)}</span>
            <span className={`lbl ${outOfRevisions ? 'full' : ''}`}>{revLabel}</span>
          </div>
          {err && <p className="rv-err">{err}</p>}
          {outOfRevisions ? (
            <div className="rv-warn">All {revisions.included} included revisions have been used. Contact Reyal Design to arrange more.</div>
          ) : (
            <button className="rv-send" data-tour="send" disabled={busy || !unsent} onClick={() => startSend()}>
              {busy ? 'Sending…' : `Send revision ${nextRev}${unsent ? ` · ${plural(unsent)}` : ''}`}
            </button>
          )}
          {canApprove && <button className="rv-approve" data-tour="approve" onClick={openTerms}><i />Approve v{current.number} as final</button>}
        </>
      )}
    </div>
  );

  // ----- Figma website review: the panel on the right, which a phone shows in its bottom sheet -----
  const sentRounds = [...new Set(roots.map((c) => c.round ?? 0))].sort((a, b) => b - a);
  const allDone = pageStates.length > 0 && doneCount === pageStates.length;
  const currentPrimary = images.find((m) => m.id === img?.id && m.device === primary)?.frameId ?? null;
  const figProgress = <ProgressCard pages={pageStates} />;
  const figTabs = (
    <div className="rv-tabs fr-tabs" role="tablist">
      <button role="tab" aria-selected={panelTab === 'pages'} className={`rv-tab ${panelTab === 'pages' ? 'on' : ''}`} onClick={() => setPanelTab('pages')}>Pages</button>
      <button role="tab" aria-selected={panelTab === 'comments'} className={`rv-tab ${panelTab === 'comments' ? 'on' : ''}`} onClick={() => setPanelTab('comments')}>Comments<span className="c">{unsent + roots.length}</span></button>
    </div>
  );
  const figBody = panelTab === 'pages' ? (
    <div className="rv-list"><PagesList pages={pageStates} currentId={currentPrimary} onGo={(id) => { setFigDevice(primary); setFigErr(''); void showFrame(id, primary); }} /></div>
  ) : (
    <div className="rv-list fr-comments">
      <div className="fr-h">Ready to send <span>({unsent})</span></div>
      {readyList}
      {sentRounds.map((rd) => {
        const items = roots.filter((c) => (c.round ?? 0) === rd);
        return (
          <div key={rd} className="fr-sentgrp">
            <button className="fr-sentbtn" aria-expanded={sentOpen} onClick={() => setSentOpen(!sentOpen)}>{rd ? `Sent in round ${rd}` : 'Sent'} ({items.length})<span aria-hidden>{sentOpen ? '▴' : '▾'}</span></button>
            {sentOpen && items.map(sentCard)}
          </div>
        );
      })}
    </div>
  );
  const figFoot = (
    <div className="rv-foot fr-foot">
      <p className="fr-info"><i aria-hidden>i</i><span>Phone and Tablet are for previewing. Comments you leave on Desktop apply to all three.</span></p>
      {err && <p className="rv-err">{err}</p>}
      {locked ? (
        <div className="rv-banner"><b>Approved by {approval!.by}</b></div>
      ) : (
        <div className="fr-actions" data-tour="actions">
          {outOfRevisions ? (
            <div className="rv-warn">All {revisions.included} included revisions have been used. Contact Reyal Design to arrange more.</div>
          ) : (
            <>
              <button className="rv-send" disabled={busy || !unsent} onClick={startSend}>{busy ? 'Sending…' : unsent ? `Send ${plural(unsent)}` : 'Send comments'}</button>
              {!unsent && <span className="fr-reason">Leave at least one comment to send.</span>}
            </>
          )}
          {canApprove && (
            <>
              <button className={`rv-approve ${allDone && !unsent ? 'ready' : ''}`} disabled={unsent > 0} onClick={openTerms}><i />Approve website</button>
              {unsent > 0 && <span className="fr-reason">You have unsent comments. {outOfRevisions ? 'Delete them, or ask Reyal Design.' : 'Send them first.'}</span>}
            </>
          )}
        </div>
      )}
    </div>
  );

  // On a Figma proof the list on the left holds the screens of the size being reviewed. One not yet fetched from Figma shows as a tile with its name.
  const figPages = figma ? figma.links[figDevice]?.pages ?? [] : [];
  const railCount = figma ? 0 : images.length;
  const figRail = figPages.map((p) => {
    const k = images.findIndex((m) => m.frameId === p.id);
    const m = k >= 0 ? images[k] : null;
    const count = m ? pageCount(m.id) : 0;
    const name = shortName(p.name) || DEVICES.find((d) => d.key === figDevice)?.label || 'Screen';
    return (
      <button key={p.id} className={`rv-page ${m && k === idx ? 'on' : ''}`} onClick={() => { setPager(false); void showFrame(p.id, figDevice); }} aria-label={`Go to ${name}`} title={name}>
        <span className={`rv-thumb ${m ? '' : 'fg-wait'}`}>
          {m ? <img src={`/files/${m.file}?w=320`} alt="" loading="lazy" /> : <span className="fg-spin" aria-hidden />}
          {marks.includes(p.id) && <span className="fg-seen s2" title="Looks good" aria-hidden>✓</span>}
          {count > 0 && <span className="rv-pins">{count}</span>}
        </span>
        <span className="n">{name}</span>
      </button>
    );
  });
  const pageThumb = (m: { id: string; file: string }, n: number) => {
    const count = pageCount(m.id);
    return (
      <button key={m.id} className={`rv-page ${n === idx ? 'on' : ''}`} onClick={() => goPage(n)} aria-label={`Go to page ${n + 1}`}>
        <span className="rv-thumb">
          <img src={`/files/${m.file}?w=320`} alt="" loading="lazy" />
          {count > 0 && <span className="rv-pins">{count}</span>}
        </span>
        <span className="n">{`Page ${n + 1}`}</span>
      </button>
    );
  };

  return (
    <div className="review">
      {figma && <Tour steps={tourSteps} open={tourOpen} onClose={closeTour} />}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Urbanist:wght@400;500;600;700;800&display=swap" />

      <div className="rv-top">
      <header className="rv-head">
        <span className="rv-mark">R</span>
        <div className="rv-titles">
          <span className="rv-title">{title}</span>
          <span className="rv-sub">{figma
            ? <span>{versionName}{isLatest ? ', latest version' : ''}</span>
            : <><span className="desk">{client} · {versionName}{isLatest ? ' · Latest' : ''}</span><span className="mob">v{current.number}{isLatest ? ' · Latest' : ''}{live ? ' · Live site' : ` · Page ${idx + 1} of ${images.length}`}</span></>}</span>
        </div>
        <div className="rv-head-right">
          <span className={`rv-status ${pill.cls}`}><span className="long">{pill.long}</span><span className="short">{pill.short}</span></span>
          {figma ? (
            !locked && <RoundBar round={waiting ? revisions.used : roundNo} included={revisions.included} sent={waiting} />
          ) : (
            <label className="rv-version">
              <span className="vlong">{versions.find((v) => v.number === current.number)?.label ?? `v${current.number}`}</span><span className="vshort">v{current.number}</span>
              {isLatest && <span className="latest">Latest</span>}
              <span className="caret">▾</span>
              <select aria-label="Version" value={current.number} onChange={(e) => router.push(`/review/${slug}?v=${e.target.value}`)}>
                {versions.map((v) => <option key={v.number} value={v.number}>{v.label}{v.number === latest ? ' (latest)' : ''}</option>)}
              </select>
            </label>
          )}
          {figma ? (
            <button className="rv-tourbtn" onClick={() => setTourOpen(true)} aria-label="Quick tour">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><circle cx="8" cy="8" r="6.5" /><path d="M6.6 5.4 10.6 8l-4 2.6z" fill="currentColor" stroke="none" /></svg>
              <span>Quick tour</span>
            </button>
          ) : (
            <button className="rv-help" onClick={() => dismissGuide(!guideHidden)} aria-label="How to review" title="How to review">?</button>
          )}
        </div>
      </header>
      {figma && !isLatest && <div className="fr-strip old" role="status"><span>This isn&apos;t the latest version.</span><button onClick={() => router.push(`/review/${slug}?v=${latest}`)}>View latest</button></div>}
      {finalRound && <div className="fr-strip final" role="status"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M8 1.8 15 14H1z" /><path d="M8 6.5v3.4M8 11.8v.1" /></svg><span>Final round. Make sure everything is covered before you send.</span></div>}
      </div>

      <div className={`rv-body ${railCount > 1 ? '' : 'single'}`}>
        {railCount > 1 && <nav className="rv-rail" aria-label="Pages">{images.map(pageThumb)}</nav>}

        <section className="rv-stage">
          {guideHidden === false && !figma && (
            <div className="rv-guide" role="note">
              <b>How to review</b>
              <span className="step"><i>1</i>Click to pin a comment</span>
              <span className="step"><i>2</i>Add all your changes</span>
              <span className="step"><i>3</i>Send as one revision, or approve</span>
              <button className="gotit" onClick={() => dismissGuide(true)}>Got it</button>
            </div>
          )}
          {figma && figDevice !== 'desktop' && (
            <div className="fr-viewonly" role="note">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><circle cx="8" cy="8" r="6.5" /><path d="M8 7.2v4M8 4.8v.1" /></svg>
              <span>View only. Leave your comments on Desktop. They apply to Phone and Tablet too.</span>
              <button onClick={() => figSize(primary)}>Go to Desktop</button>
            </div>
          )}
          {figma && (() => {
            const k = figPages.findIndex((p) => p.id === img?.frameId);
            const go = (n: number) => { setPager(false); void showFrame(figPages[n]?.id ?? null, figDevice); };
            const name = shortName(figPages[k]?.name) || DEVICES.find((d) => d.key === figDevice)?.label || 'Page';
            const cur = img?.frameId ?? '';
            const good = marks.includes(cur);
            return (
              <div className="fr-bar">
                <div className="lv-seg fr-sizes" role="group" aria-label="Screen size" data-tour="sizes">
                  {figDevices.map((d) => (
                    <button key={d.key} className={figDevice === d.key ? 'on' : ''} onClick={() => figSize(d.key)}>
                      {d.label}
                      {d.key !== 'desktop' && <svg className="eye" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-label="preview only"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" /></svg>}
                    </button>
                  ))}
                </div>
                {figPages.length > 0 && (
                  <div className="fr-stepper" data-tour="pager">
                    {pager && <div className="fg-pop" role="listbox" aria-label="Pages">{figRail}{missing > 0 && <p className="fg-load">{missing === 1 ? '1 page is' : `${missing} pages are`} still loading from Figma in the background. You can tap a page to load it now.</p>}</div>}
                    <button className="fr-arrow" disabled={k <= 0 || figBusy} onClick={() => go(k - 1)} aria-label="Previous page">‹</button>
                    <button className="fr-pick" onClick={() => setPager(!pager)} aria-expanded={pager} aria-haspopup="listbox">
                      <span className="lbl">Page {k >= 0 ? k + 1 : 1} of {figPages.length}</span>
                      <b>{name}</b>
                    </button>
                    <button className="fr-arrow" disabled={k < 0 || k >= figPages.length - 1 || figBusy} onClick={() => go(k + 1)} aria-label="Next page">›</button>
                    {figDevice === 'desktop' && !locked && (
                      <button className={`fr-good ${good ? 'on' : ''}`} aria-pressed={good} disabled={!cur} onClick={() => toggleGood(cur)}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="m3 8.5 3.2 3.2L13 4.8" /></svg>Looks good
                      </button>
                    )}
                  </div>
                )}
                <p className="fr-helper">{locked ? 'Approved · view only' : figDevice === 'desktop' ? 'Click anywhere on the page to leave a comment.' : `You are previewing how your website looks on ${figDevice === 'mobile' ? 'a phone' : 'a tablet'}.`}</p>
                {figErr && <span className="rv-err" role="alert">{figErr}</span>}
              </div>
            );
          })()}
          <div ref={canvasRef} className="rv-canvas" data-tour="design"
            onPointerMove={figma ? (e) => { if (e.pointerType !== 'mouse' || figDevice !== 'desktop' || locked || pop || !canvasRef.current) { setTip(null); return; } const b = canvasRef.current.getBoundingClientRect(); setTip({ x: e.clientX - b.left, y: e.clientY - b.top }); } : undefined}
            onPointerLeave={figma ? () => setTip(null) : undefined}>
            {figma && tip && figMode === 'comment' && <span className="fr-tip" style={{ left: tip.x + 16, top: tip.y + 18 }} aria-hidden>Click to comment</span>}
            {live && (
              <LiveStage ref={liveRef} url={live} pins={livePins} readOnly={locked} focusId={focus} onPick={livePick} onShot={liveShot} onBridge={setBridge} onMode={setLiveMode} onPinClick={(id) => { setTab('sent'); setFocus(id); }}>
                {pop && newDraft && (
                  <div className="rv-pop" style={{ left: Math.min(Math.max(pop.flip ? pop.left - 300 - 22 : pop.left + 22, 8), Math.max(8, stage.w - 308)), top: Math.min(Math.max(pop.top - 24, 8), Math.max(8, stage.h - 260)) }}>
                    <div className="hd"><span className="rv-num">{draftPin(pop.tid)}</span>New comment</div>
                    {newDraft.live?.elementText && <span className="rv-where">On “{newDraft.live.elementText.slice(0, 80)}”</span>}
                    <textarea
                      autoFocus rows={3} value={popText} onChange={(e) => { setPopText(e.target.value); setPopErr(''); }} placeholder="What should change here?"
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) closePop(true); if (e.key === 'Escape') closePop(false); }}
                    />
                    {newDraft.live?.shot && <img className="rv-shotthumb" src={`/files/${newDraft.live.shot}?w=320`} alt="Screenshot of this spot" />}
                    {popErr && <p className="rv-err" role="alert">{popErr}</p>}
                    <div className="rv-actions">
                      <button className="rv-ghost" onClick={() => closePop(false)}>Cancel</button>
                      <button className="rv-light" onClick={() => closePop(true)}>Add comment</button>
                    </div>
                  </div>
                )}
              </LiveStage>
            )}
            {showImg && figma && img && nat && (
              <div ref={scrollRef} className="fg-scroll" onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })} onPointerUp={place}>
                <div className="fg-sheet" style={{ width: Math.max(160, Math.min(img.fw || nat.w / 2, stage.w - 48)), cursor: locked || figDevice !== 'desktop' ? 'default' : 'crosshair' }}>
                  <img ref={imgRef} className="rv-img" src={`/files/${img.file}`} alt={`${title}, ${viewLabel(idx)}`} draggable={false} style={{ width: '100%', height: 'auto', display: 'block' }} />
                  {sentHere.map((c) => <Pin key={c.id} n={c.pin!} kind={c.resolved ? 'done' : 'open'} x={c.x!} y={c.y!} scale={1} onClick={() => setTab('sent')} />)}
                  {draftsHere.map((d) => <Pin key={d.tid} n={draftPin(d.tid)} kind="draft" x={d.x!} y={d.y!} scale={1} onClick={() => setTab('send')} />)}
                  {newDraft && <Pin key={`new-${newDraft.tid}`} n={draftPin(newDraft.tid)} kind="new" x={newDraft.x!} y={newDraft.y!} scale={1} />}
                </div>
              </div>
            )}
            {showImg && !figma && size && (
              <TransformWrapper
                key={img.id} ref={tw} minScale={0.5} maxScale={8} centerOnInit={!tall} wheel={{ disabled: tall }} doubleClick={{ disabled: true }}
                onTransform={(_ref, s) => setScale(s.scale)}
              >
                <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: stage.w, height: tall ? Math.max(stage.h, size.height + 48) : stage.h, display: 'flex', alignItems: tall ? 'flex-start' : 'center', justifyContent: 'center', paddingTop: tall ? 24 : 0, boxSizing: 'border-box' }}>
                  <div
                    style={{ position: 'relative', ...size, cursor: locked ? 'grab' : 'crosshair' }}
                    onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
                    onPointerUp={place}
                  >
                    <img ref={imgRef} className="rv-img" src={`/files/${img.file}`} alt={`${title}, page ${idx + 1}`} draggable={false} style={size} />
                    {sentHere.map((c) => (
                      <Pin key={c.id} n={c.pin!} kind={c.resolved ? 'done' : 'open'} x={c.x!} y={c.y!} scale={scale} onClick={() => setTab('sent')} />
                    ))}
                    {draftsHere.map((d) => (
                      <Pin key={d.tid} n={draftPin(d.tid)} kind="draft" x={d.x!} y={d.y!} scale={scale} onClick={() => setTab('send')} />
                    ))}
                    {newDraft && <Pin key={`new-${newDraft.tid}`} n={draftPin(newDraft.tid)} kind="new" x={newDraft.x!} y={newDraft.y!} scale={scale} />}
                  </div>
                </TransformComponent>
              </TransformWrapper>
            )}
            {showImg && (figma ? !(img && nat) : !size) && <div className="rv-loading">{figBusy ? 'Loading this screen from Figma. A long page can take up to a minute…' : figma && !img ? 'Switch to Comment to pin a note on a screen.' : 'Loading design…'}</div>}
            {figma && figMode === 'browse' && (
              figma.links[figDevice]
                ? <FigmaStage src={previewSrc} width={figDevice === 'mobile' ? 470 : DEVICES.find((d) => d.key === figDevice)?.width ?? null} onNode={setFigNode} />
                : <div className="rv-loading">There is no design for this screen size.</div>
            )}
            {figmaMissing && <div className="rv-loading">This Figma proof is not ready yet. Please ask Reyal Design to check it.</div>}
            {showImg && <div className="rv-mobhint">{locked ? 'Approved · view only' : figma ? (figDevice === 'desktop' ? 'Tap the page to leave a comment' : 'View only') : 'Tap the design to comment'}</div>}

            {showImg && !figma && <div className="rv-controls">
              <button className="rv-ctl" aria-label="Zoom in" onClick={() => tw.current?.zoomIn()}>+</button>
              <button className="rv-ctl" aria-label="Zoom out" onClick={() => tw.current?.zoomOut()}>−</button>
              <button className="rv-ctl txt" onClick={() => tw.current?.resetTransform()}>Fit</button>
            </div>}
            <div className={`rv-hint ${figma ? 'fg-hint' : ''}`}>{locked ? 'Approved · view only' : live ? (bridge === 'missing' ? 'Pinned comments are off for this site · use the general comment box' : liveMode === 'browse' ? 'Browse mode: use the links on the site, switch to Comment to leave notes' : 'Comment mode: click any part of the page') : figma ? (figMode === 'browse' ? 'Preview: click through the prototype, then press Back to comments' : 'Click the screen to pin a note') : `Page ${idx + 1} of ${images.length} · click to comment`}</div>

            {showImg && pop && newDraft && (
              <div
                className="rv-pop"
                style={{
                  left: Math.min(Math.max(pop.flip ? pop.left - 300 - 22 : pop.left + 22, 8), Math.max(8, stage.w - 308)),
                  top: Math.min(Math.max(pop.top - 24, 8), Math.max(8, stage.h - 200)),
                }}
              >
                <div className="hd"><span className="rv-num">{draftPin(pop.tid)}</span>New comment</div>
                <textarea
                  autoFocus rows={3} value={popText} onChange={(e) => { setPopText(e.target.value); setPopErr(''); }} placeholder="What should change here?"
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) closePop(true); if (e.key === 'Escape') closePop(false); }}
                />
                {popErr && <p className="rv-err" role="alert">{popErr}</p>}
                <div className="rv-actions">
                  <button className="rv-ghost" onClick={() => closePop(false)}>Cancel</button>
                  <button className="rv-light" onClick={() => closePop(true)}>Add comment</button>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className={`rv-panel ${figma ? 'fr-panel' : ''}`} aria-label="Comments" data-tour="comments">
          {figma ? <>{figProgress}{figTabs}{figBody}{figFoot}</> : <>{tabs}{list}{foot}</>}
        </aside>

        {/* mobile bottom sheet */}
        <div className="rv-sheet">
          <button className="rv-handle" onClick={() => setSheet(!sheet)} aria-label={sheet ? 'Collapse comments' : 'Expand comments'} aria-expanded={sheet} />
          <div className="rv-sheet-row">
            {figma ? (
              <>
                <b>{doneCount} of {pageStates.length} pages done</b>
                <span>{locked ? 'Closed' : unsent ? `${unsent} to send` : 'None to send'}</span>
                <span className="rev" style={{ color: outOfRevisions ? 'var(--yellow)' : undefined }}>{`Round ${roundNo} of ${revisions.included}`}</span>
              </>
            ) : (
              <>
                <b>Your comments</b>
                <span>{locked ? 'Closed' : unsent ? `${unsent} to send` : 'None to send'}</span>
                <span className="rev" style={{ color: outOfRevisions ? 'var(--yellow)' : undefined }}>{revLabel}</span>
              </>
            )}
          </div>
          {sheet ? (
            figma ? <>{figProgress}{figTabs}{figBody}{figFoot}</> : (
              <>
                {railCount > 1 && <div className="rv-strip">{images.map(pageThumb)}</div>}
                {tabs}
                {list}
                {foot}
              </>
            )
          ) : (
            <>
              {!figma && sendable[0] && (
                <div className="rv-first">
                  <span className="rv-num">{sendable[0].x == null ? 'G' : draftPin(sendable[0].tid)}</span>
                  <span className="tx">{sendable[0].text}</span>
                </div>
              )}
              {lastSent && !figma && <div className="rv-banner"><b>{lastSent}</b></div>}
              {locked ? (
                <div className="rv-banner"><b>Approved by {approval!.by}</b></div>
              ) : (
                <div className="btns" data-tour="actions">
                  {outOfRevisions ? (
                    <div className="rv-warn">All {revisions.included} revisions used. Contact Reyal Design.</div>
                  ) : (
                    <button className="rv-send" disabled={busy || !unsent} onClick={startSend}>{figma ? (unsent ? `Send ${plural(unsent)}` : 'Send comments') : `Send revision ${nextRev}${unsent ? ` (${unsent})` : ''}`}</button>
                  )}
                  {canApprove && <button className="rv-approve" disabled={!!figma && unsent > 0} onClick={openTerms}>{figma ? 'Approve website' : 'Approve'}</button>}
                </div>
              )}
              {figma && !locked && !outOfRevisions && !unsent && <span className="fr-reason">Leave at least one comment to send.</span>}
              {figma && !locked && canApprove && unsent > 0 && <span className="fr-reason">You have unsent comments. Send them first.</span>}
              {err && <p className="rv-err">{err}</p>}
            </>
          )}
        </div>
      </div>

      {figma && guard && <GuardDialog open={openPages.map((p) => p.name)} last={roundNo >= revisions.included} onKeep={() => setGuard(false)} onSendAnyway={() => { setGuard(false); setConfirmSend(true); }} />}

      {confirmSend && (figma ? (
        <SendDialog
          round={roundNo} included={revisions.included} comments={unsent} pages={new Set(sendable.filter((d) => d.imageId && d.x != null).map((d) => d.imageId)).size}
          whole={whole} setWhole={setWhole} wholeTooShort={!!whole.trim() && !real(whole)} name={name} setName={setName} busy={busy}
          onCancel={() => setConfirmSend(false)} onSend={send}
        />
      ) : (
        <div className="rv-overlay" role="dialog" aria-modal="true" aria-labelledby="rev-h" onKeyDown={(e) => { if (e.key === 'Escape' && !busy) setConfirmSend(false); }}>
          <div className="rv-modal">
            <h2 id="rev-h">{`Send revision ${nextRev} of ${revisions.included}?`}</h2>
            <p className="fg-verline">Reviewing: <b>{versionName}</b> · This will be revision {nextRev} of {revisions.included}.</p>
            <p>You&apos;re sending <b>{plural(unsent)}</b>. Make sure this is everything you want changed in this round. Anything you add later goes into the next revision.</p>
            {nextRev === revisions.included && <div className="rv-warn">This is your last included revision.</div>}
            <input className="rv-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" aria-label="Your name" />
            <div className="rv-actions">
              <button className="rv-ghost" onClick={() => setConfirmSend(false)} disabled={busy}>Keep editing</button>
              <button className="rv-primary" onClick={send} disabled={busy}>{busy ? 'Sending…' : `Send revision ${nextRev}`}</button>
            </div>
          </div>
        </div>
      ))}

      {terms && (figma ? (
        <ApproveDialog name={aname} setName={setAname} agree={agree} setAgree={setAgree} busy={abusy} err={aerr} onCancel={() => setTerms(false)} onApprove={approve} />
      ) : (
        <div className="rv-overlay" role="dialog" aria-modal="true" aria-labelledby="terms-h" onKeyDown={(e) => { if (e.key === 'Escape' && !abusy) setTerms(false); }}>
          <div className="rv-modal wide">
            <h2 id="terms-h">Approve v{current.number} as final</h2>
            <p>You confirm you&apos;ve reviewed every page and that the design, text, images and details are correct. <b>No more revisions can be made after approval.</b> Later changes become a new job.</p>
            {unsent > 0 && <div className="rv-warn">You have {plural(unsent)} you haven&apos;t sent. They&apos;ll be discarded if you approve.</div>}
            <input className="rv-field" value={aname} onChange={(e) => setAname(e.target.value)} placeholder="Your full name" autoComplete="name" aria-label="Your full name" />
            <label className="rv-check">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <i>{agree ? '✓' : ''}</i>
              I&apos;ve reviewed this proof and agree to these terms.
            </label>
            {aerr && <p className="rv-err">{aerr}</p>}
            <div className="rv-actions">
              <button className="rv-ghost" onClick={() => setTerms(false)} disabled={abusy}>Cancel</button>
              <button className="rv-go" disabled={abusy || !agree || aname.trim().length < 2} onClick={approve}>{abusy ? 'Approving…' : 'Approve and finalize'}</button>
            </div>
          </div>
        </div>
      ))}

      {figma && finalIntro && !tourOpen && !success && (
        <FinalRoundDialog used={revisions.used} included={revisions.included} round={roundNo} onStart={() => { store.set(`rp:final:${slug}:${nextRev}`, '1'); setFinalIntro(false); }} />
      )}
      {figma && success && (
        <SuccessScreen
          kind={success.kind} round={success.round} included={revisions.included} comments={success.comments} pages={success.pages}
          date={new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          onClose={() => { if (success.kind === 'sent') { setPanelTab('comments'); setSentOpen(true); } setSuccess(null); }}
        />
      )}
      {toast && (
        <div className="fr-toast" role="status">
          <span>{toast.msg}</span>
          {toast.action && <button onClick={toast.action.run}>{toast.action.label}</button>}
        </div>
      )}
    </div>
  );
}
