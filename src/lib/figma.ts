// Figma prototype proofs: the pasted links, the embed address, and the three Figma API calls this app makes
// (read a frame's size, export it as an image, post a comment on it). The token is the Reyal account's, from FIGMA_TOKEN.
import sharp from 'sharp';
import { NODE_RE, type FigmaLink, type FigmaPage } from './figmaShared';

export * from './figmaShared';

export const figmaClientId = () => process.env.FIGMA_CLIENT_ID?.trim() || '';
export const figmaConfigured = () => !!process.env.FIGMA_TOKEN?.trim() && !!figmaClientId();

/** The address Figma's embed needs. client-id is what makes it send events back to our page. */
export function embedUrl(l: FigmaLink) {
  const q = new URLSearchParams();
  if (l.start) q.set('node-id', l.start.replace(':', '-'));
  if (l.page) q.set('page-id', l.page);
  if (l.start) q.set('starting-point-node-id', l.start);
  q.set('scaling', l.scaling ?? 'scale-down');
  q.set('content-scaling', 'fixed');
  q.set('hide-ui', '1');
  q.set('embed-host', 'reyal-studio');
  q.set('client-id', figmaClientId());
  return `https://embed.figma.com/proto/${l.file}/${encodeURIComponent(l.name || 'proof')}?${q}`;
}

export class FigmaError extends Error { constructor(public status: number, message: string) { super(message); } }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Figma limits how many requests one account may make in a minute. Every request starts through this gate, one every few seconds,
// and a "slow down" answer pauses all of them for as long as Figma asks.
const SPACING_MS = 3500;
let nextAt = 0;
let gate: Promise<void> = Promise.resolve();
function pace() {
  const turn = gate.then(async () => {
    const wait = nextAt - Date.now();
    if (wait > 0) await sleep(wait);
    nextAt = Math.max(nextAt, Date.now()) + SPACING_MS;
  });
  gate = turn.catch(() => {});
  return turn;
}

async function call(path: string, init?: RequestInit) {
  const token = process.env.FIGMA_TOKEN?.trim();
  if (!token) throw new FigmaError(503, 'FIGMA_TOKEN is not set on the server.');
  for (let attempt = 0; ; attempt++) {
    await pace();
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 150_000); // Figma takes up to a minute to render a long page
    try {
      const r = await fetch(`https://api.figma.com${path}`, { ...init, signal: ctl.signal, headers: { 'X-Figma-Token': token, ...(init?.headers ?? {}) } });
      if (r.status === 429) {
        const secs = Number(r.headers.get('retry-after'));
        const wait = Number.isFinite(secs) && secs > 0 ? secs : 30;
        console.error('figma rate limit', { path: path.split('?')[0].replace(/\/[A-Za-z0-9]{10,}/g, '/...'), retryAfter: r.headers.get('retry-after'), plan: r.headers.get('x-figma-plan-tier'), type: r.headers.get('x-figma-rate-limit-type'), attempt });
        if (wait > 120) throw new FigmaError(429, 'Figma has paused this account for a while because its usage limit was reached. Try again later.');
        if (attempt >= 3) throw new FigmaError(429, 'Figma is busy. Try again in a minute.');
        nextAt = Date.now() + wait * 1000 + 500; // everything waits, not just this request
        continue;
      }
      if (!r.ok) throw new FigmaError(r.status, r.status === 403 || r.status === 401 ? 'Figma refused the token. It may have expired.' : r.status === 404 ? 'That Figma file or screen was not found.' : `Figma error ${r.status}.`);
      return (await r.json()) as Record<string, unknown>;
    } catch (e) {
      if (e instanceof FigmaError) throw e;
      throw new FigmaError(502, 'Could not reach Figma.');
    } finally { clearTimeout(t); }
  }
}

type NodeBox = { name: string; w: number; h: number };
/** The name and size of one screen of the prototype. */
export async function frameInfo(file: string, node: string): Promise<NodeBox> {
  const j = await call(`/v1/files/${file}/nodes?ids=${encodeURIComponent(node)}&depth=1`);
  const n = (j.nodes as Record<string, { document?: { name?: string; type?: string; absoluteBoundingBox?: { width: number; height: number } } } | null> | undefined)?.[node]?.document;
  const b = n?.absoluteBoundingBox;
  if (!n || !b || !/^(FRAME|COMPONENT|COMPONENT_SET|INSTANCE|SECTION)$/.test(n.type ?? '')) throw new FigmaError(404, 'That screen could not be found in the Figma file.');
  return { name: String(n.name ?? '').slice(0, 120), w: Math.round(b.width), h: Math.round(b.height) };
}

const MAX_W = 1800; // a screen is exported at most this wide, so a long page stays a sensible size
const MAX_SIDE = 12000;
/** One screen as a JPEG. */
export async function exportFrame(file: string, node: string, known?: NodeBox): Promise<{ buf: Buffer; name: string; w: number; h: number }> {
  const info = known && known.w > 0 && known.h > 0 ? known : await frameInfo(file, node); // sizes already found when the proof was made save a request
  const scale = Math.max(0.1, Math.min(2, MAX_W / info.w, MAX_SIDE / info.h));
  const j = await call(`/v1/images/${file}?ids=${encodeURIComponent(node)}&format=jpg&scale=${scale.toFixed(2)}&use_absolute_bounds=true`);
  const url = (j.images as Record<string, string | null> | undefined)?.[node];
  if (!url || !/^https:\/\/[\w.-]+\.amazonaws\.com\//.test(url)) throw new FigmaError(502, 'Figma could not make an image of that screen.');
  const r = await fetch(url);
  if (!r.ok) throw new FigmaError(502, 'Could not download the screen image from Figma.');
  const buf = await sharp(Buffer.from(await r.arrayBuffer()), { limitInputPixels: 200_000_000 }).flatten({ background: '#ffffff' }).jpeg({ quality: 86 }).toBuffer();
  return { buf, name: info.name, w: info.w, h: info.h };
}

/** Posts a comment on a screen at a spot (pixels from the screen's top left). Returns the new comment's id. */
export async function postFigmaComment(file: string, node: string, at: { x: number; y: number }, message: string): Promise<string> {
  const j = await call(`/v1/files/${file}/comments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: message.slice(0, 7000), client_meta: { node_id: node, node_offset: { x: Math.round(at.x), y: Math.round(at.y) } } }),
  });
  return String(j.id ?? '');
}

/** Names that are notes for the team, not screens of the design. */
const NOT_A_SCREEN = /^\[(handoff|note|notes|spec|annotation)/i;
/**
 * The screens of one size's prototype: every frame on the same Figma page that is as wide as the start screen
 * (overlays and notices are narrower), in the order they sit in the file, minus team notes. Falls back to the start screen alone.
 */
export async function discoverPages(link: FigmaLink): Promise<FigmaPage[]> {
  if (!link.start) return [];
  if (!link.page) { const start = await frameInfo(link.file, link.start); return [{ id: link.start, name: start.name, w: start.w, h: start.h }]; }
  const j = await call(`/v1/files/${link.file}/nodes?ids=${encodeURIComponent(link.page)}&depth=1`);
  const doc = (j.nodes as Record<string, { document?: { children?: { id: string; name: string; type: string; absoluteBoundingBox?: { width: number; height: number } }[] } } | null> | undefined)?.[link.page]?.document;
  const kids = (doc?.children ?? []).filter((c) => c.type === 'FRAME' && c.absoluteBoundingBox && NODE_RE.test(c.id));
  const startKid = kids.find((c) => c.id === link.start);
  const start = startKid ? { name: startKid.name, w: Math.round(startKid.absoluteBoundingBox!.width), h: Math.round(startKid.absoluteBoundingBox!.height) } : await frameInfo(link.file, link.start);
  const pages: FigmaPage[] = [];
  for (const c of kids) {
    const b = c.absoluteBoundingBox!;
    if (NOT_A_SCREEN.test(c.name) || Math.abs(Math.round(b.width) - start.w) > 1) continue;
    pages.push({ id: c.id, name: String(c.name).slice(0, 120), w: Math.round(b.width), h: Math.round(b.height) });
  }
  if (!pages.some((p) => p.id === link.start)) pages.unshift({ id: link.start, name: start.name.slice(0, 120), w: start.w, h: start.h });
  return pages.slice(0, 40);
}
