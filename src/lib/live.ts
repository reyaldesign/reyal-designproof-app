// Live website proofs: shared bits for the review page, the admin page and the API.
export type Device = 'desktop' | 'tablet' | 'mobile';
export const DEVICES: { key: Device; label: string; width: number | null }[] = [
  { key: 'desktop', label: 'Desktop', width: null }, // fills the stage
  { key: 'tablet', label: 'Tablet', width: 820 },
  { key: 'mobile', label: 'Phone', width: 390 },
];
export const isDevice = (v: unknown): v is Device => v === 'desktop' || v === 'tablet' || v === 'mobile';

/** A review URL for a live site: http or https only. Returns the cleaned address, or null. */
export function cleanLiveUrl(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.') && u.hostname !== 'localhost') return null;
    return u.toString();
  } catch { return null; }
}

/** The part of a page address people recognise: /menu/ rather than the whole URL. */
export function pathOf(url: string | null | undefined) {
  if (!url) return '';
  try { const u = new URL(url); return `${u.pathname}${u.search}` || '/'; } catch { return url; }
}
export const hostOf = (url: string | null | undefined) => { try { return new URL(url ?? '').host; } catch { return ''; } };

/** The same page at another address (different query, hash or trailing slash) is still the same page. */
export const samePage = (a: string | null | undefined, b: string | null | undefined) => {
  const key = (u: string | null | undefined) => { try { const x = new URL(u ?? ''); return `${x.origin}${x.pathname.replace(/\/+$/, '')}`; } catch { return ''; } };
  return !!key(a) && key(a) === key(b);
};
