// Browser-safe helpers for the Websites tool: the columns, the address clean-up, and the CSV reader. No server imports.

export const CHECK_EVERY_MIN = 30; // how often every Live website is checked
export const KEEP_DAYS = 90; // how long check history is kept

/** The columns, in the order of the team's sheet. `list` fields offer the values already in use as suggestions, and accept new ones. */
export const FIELDS = [
  { key: 'clientName', label: 'Client Name', csv: 'Client Name' },
  { key: 'url', label: 'Website Link', csv: 'Website Link' },
  { key: 'status', label: 'Status', csv: 'Status', list: ['Live', 'In Progress', 'Forward Only', 'For Transfer', 'Not live', 'Discontinued'] },
  { key: 'server', label: 'Server Used', csv: 'Server Used', list: ['VPS54387 Enterprise', 'VPS53108 Professional', 'Client Hosting', 'Namecheap Server', 'Shopify', 'N/A'] },
  { key: 'captcha', label: 'Forms Captcha V3', csv: 'Forms Captcha V3', list: ['Active (Forms/NL)', 'Active', 'Not Active', 'Shopify Built In', 'N/A'] },
  { key: 'backup', label: 'Backup Enabled', csv: 'Backup Enabled', list: ['Active', 'N/A'] },
  { key: 'desktopStatus', label: 'Desktop Status', csv: 'Desktop Status', list: ['Good'] },
  { key: 'mobileStatus', label: 'Mobile/Tablet Status', csv: 'Mobile/Tablet Status', list: ['Good'] },
  { key: 'seo', label: 'SEO', csv: 'SEO', list: ['Running', 'Google Site Kit', 'Google Site Kit Only', 'Not Started', 'N/A'] },
  { key: 'formSubmission', label: 'Form Submission', csv: 'Form Submission', list: ['Ok', 'To check'] },
  { key: 'emailUsed', label: 'E-mail Used', csv: 'E-mail Used' },
] as const;
export type FieldKey = (typeof FIELDS)[number]['key'];
export type SiteFields = Record<FieldKey, string>;

/** Only sites with this status are checked. */
export const MONITORED = 'Live';
export const isMonitored = (s: { status: string; url: string }) => s.status.trim().toLowerCase() === MONITORED.toLowerCase() && !!s.url.trim();

/** "example.com" becomes "https://example.com". Anything that is not a web address comes back empty. */
export function cleanUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, '')}`;
  try {
    const u = new URL(withScheme);
    if ((u.protocol !== 'http:' && u.protocol !== 'https:') || !u.hostname.includes('.')) return '';
    return u.href;
  } catch { return ''; }
}
/** www or not, http or https, a trailing slash or not: the same site. Used to skip duplicates on import. */
export const siteKey = (url: string) => url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
export const hostOf = (url: string) => { try { return new URL(url).host.replace(/^www\./, ''); } catch { return url; } };

/** Reads CSV text (quotes, commas and line breaks inside quotes) into rows of cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

export type Stat = { up: number; total: number };
export const pct = (s: Stat | undefined) => (s && s.total ? Math.round((s.up / s.total) * 1000) / 10 : null);

/** "5 min ago" from an ISO time. */
export const ago = (iso: string | null) => {
  if (!iso) return '';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};
export const upClass = (p: number | null) => (p == null ? 'ws-none' : p >= 99.5 ? 'ws-good' : p >= 95 ? 'ws-warn' : 'ws-bad');
export const STATE_LABEL = { up: 'Up', down: 'Down', none: 'Not checked yet', off: 'Not monitored' } as const;

