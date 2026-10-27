// Figma prototype links: shared by the server and the browser. Nothing server-only in this file.
import type { Device } from './live';

/** One screen of a size's prototype: its Figma node, its name and its size in Figma. */
export type FigmaPage = { id: string; name: string; w: number; h: number };
export type FigmaLink = { url: string; file: string; name: string; page: string | null; start: string | null; scaling: string | null; pages?: FigmaPage[] };
export type FigmaProof = Partial<Record<Device, FigmaLink>>;

export const NODE_RE = /^\d+:\d+$/;
const toNode = (v: string | null) => { const n = (v ?? '').replace('-', ':'); return NODE_RE.test(n) ? n : null; };

/** A Figma prototype ("Present") link. Anything else, including a design file link, is refused. */
export function parseFigmaUrl(input: string): FigmaLink | null {
  try {
    const u = new URL(input.trim());
    if (u.protocol !== 'https:' || !/^(www\.)?figma\.com$/.test(u.hostname)) return null;
    const m = /^\/proto\/([A-Za-z0-9]{10,40})(?:\/([^/]*))?$/.exec(u.pathname);
    if (!m) return null;
    const start = toNode(u.searchParams.get('starting-point-node-id')) ?? toNode(u.searchParams.get('node-id'));
    const pageRaw = u.searchParams.get('page-id');
    return {
      url: `https://www.figma.com/proto/${m[1]}${m[2] ? `/${m[2]}` : ''}${u.search}`,
      file: m[1], name: m[2] ?? '', start,
      page: pageRaw && /^\d+[:-]\d+$/.test(pageRaw) ? pageRaw.replace('-', ':') : null,
      scaling: u.searchParams.get('scaling') && /^[\w-]+$/.test(u.searchParams.get('scaling')!) ? u.searchParams.get('scaling') : null,
    };
  } catch { return null; }
}

export function parseFigma(json: string | null | undefined): FigmaProof | null {
  if (!json) return null;
  try {
    const raw = JSON.parse(json) as Record<string, FigmaLink | undefined>;
    const out: FigmaProof = {};
    for (const d of ['desktop', 'mobile', 'tablet'] as const) {
      const l = raw[d] && parseFigmaUrl(raw[d]!.url);
      if (!l) continue;
      const pages = (raw[d]!.pages ?? []).filter((p) => p && NODE_RE.test(p.id) && Number.isFinite(p.w) && Number.isFinite(p.h)).slice(0, 40).map((p) => ({ id: p.id, name: String(p.name ?? '').slice(0, 120), w: Math.round(p.w), h: Math.round(p.h) }));
      out[d] = pages.length ? { ...l, pages } : l;
    }
    return Object.keys(out).length ? out : null;
  } catch { return null; }
}

