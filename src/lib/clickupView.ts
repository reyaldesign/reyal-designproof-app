import type { CuTask } from './clickup';

// Reyal's ClickUp layout. Change these if the workspace is reorganised.
export const TEAM_ID = '52018';
export const SPACE_ID = '90170765113'; // Fulfillment: one folder per client
export const SPACE_NAME = 'Fulfillment';
export const BOARD_LIST_ID = '901705928506'; // Website Change Request: the board opens here
export const PROGRESS_FIELD = 'WMT Task Progress'; // dropdown that makes the board columns, where a list has it
export const TZ = 'America/New_York';
// Folders that hold requests rather than one client. Tasks there are named after the client.
const TASK_IS_CLIENT = ['Web Change Request'];
/** Fulfillment folders shown under "Teams" in the panel. Every other folder is a client. */
export const TEAM_FOLDERS = ['Ads Team', 'SEO Management Team', 'Social Media Team', 'Web Change Request'];
/** Client folders that share one of these prefixes are grouped as "N locations". Display only, ClickUp is unchanged. */
export const GROUP_PREFIXES = ['El Jalisco', 'Rodeo', 'Los Bravos'];
const SPACE_TILES: Record<string, string> = { Testing: '#b58a1e', 'Template Library': '#2f8a6a', Fulfillment: '#9a5a1e' };

// ----- dates, always read in the studio's time zone -----
export const dayKey = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
export const todayKey = () => dayKey(Date.now());
const utc = (key: string, hour = 12) => { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d, hour); };
export const shift = (key: string, days: number) => new Date(utc(key) + days * 864e5).toISOString().slice(0, 10);
export const between = (a: string, b: string) => Math.round((utc(b) - utc(a)) / 864e5); // days from a to b
/** A due date set from this tool lands mid-afternoon Eastern, so it never slips to the next day. */
export const dueMs = (key: string) => utc(key, 16);
export const rangeMs = (key: string) => utc(key, 0);
export const fmtDay = (key: string, o: Intl.DateTimeFormatOptions) => new Date(utc(key)).toLocaleDateString('en-US', { timeZone: 'UTC', ...o });
export const mondayOf = (key: string) => shift(key, -((new Date(utc(key)).getUTCDay() + 6) % 7));

/** The due badge on cards and rows: "Sep 27 · 13d late", "Today", or the date. Null when there is no due date. */
export function dueBadge(t: CuTask) {
  if (!t.due_date) return null;
  const k = dayKey(Number(t.due_date)), n = between(todayKey(), k), date = fmtDay(k, { month: 'short', day: 'numeric' });
  if (isDone(t)) return { label: date, tone: 'done' };
  if (n < 0) return { label: `${date} · ${-n}d late`, tone: 'late' };
  if (n === 0) return { label: 'Today', tone: 'today' };
  return { label: date, tone: '' };
}
export const isLate = (t: CuTask) => !isDone(t) && !!t.due_date && dayKey(Number(t.due_date)) < todayKey();
export const isThisWeek = (t: CuTask) => { if (isDone(t) || !t.due_date) return false; const n = between(todayKey(), dayKey(Number(t.due_date))); return n >= 0 && n <= 7; };

// ----- naming -----
const TYPES: Record<string, string> = { WEB: 'Website', SM: 'Social media', ADS: 'Ads', GDPT: 'Graphic design', GD: 'Graphic design', PRINT: 'Print', RDTV: 'Video', DRONE: 'Drone', SEO: 'SEO' };
const TYPE_DOT: Record<string, string> = { Ads: '#ff9b4a', Website: '#6aa9ff', 'Social media': '#ff6fa8' };
export const typeDot = (type: string) => TYPE_DOT[type] ?? '#8b8b95';
const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** "25050-WEB-SNV-Maintenance" reads as "Website · Maintenance". Names that do not fit the pattern are shown as they are. */
export function readableList(name: string) {
  const m = /^(\d{5})-([A-Z]+)-([A-Za-z]+)(?:-(.+))?$/.exec(name);
  if (!m) return { label: name, code: '', type: '' };
  const type = TYPES[m[2]] ?? titleCase(m[2]);
  const extra = m[4] ? (m[4] === m[4].toUpperCase() ? titleCase(m[4]) : m[4]) : '';
  return { label: extra ? `${type} · ${extra}` : type, code: name, type };
}

/** "SNV - Lunch Deal" in the Spice n Vybe folder reads as "Lunch Deal": the folder already says whose it is. */
export function shortTitle(t: CuTask) {
  const abbr = (t.folder?.name ?? '').replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 3);
  return abbr.length > 1 ? t.name.replace(new RegExp(`^${abbr}\\s*[-:]\\s*`, 'i'), '') || t.name : t.name;
}

export const clientOf = (t: CuTask) => (!t.folder?.name || TASK_IS_CLIENT.includes(t.folder.name) ? t.name : t.folder.name);
export const spaceTile = (name: string) => SPACE_TILES[name] ?? colorFor(name);

const HUES = ['#3b6ea5', '#2f8f6b', '#8a5a2b', '#6b4fa3', '#a3406b', '#4a6b7a', '#a37f2b', '#2b7a7a'];
export const colorFor = (s: string) => HUES[[...s].reduce((n, c) => n + c.charCodeAt(0), 0) % HUES.length];
export const initialsOf = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

/** Where a task stands. Lists with the progress dropdown use it. Every other list falls back to its ClickUp status. */
export function progressOf(t: CuTask) {
  const f = t.custom_fields?.find((x) => x.name === PROGRESS_FIELD && x.type === 'drop_down');
  if (!f) return { kind: 'status' as const, field: null, options: [], name: t.status.status, color: t.status.color, id: '' };
  const options = f.type_config?.options ?? [];
  const o = f.value == null ? undefined : options.find((x) => x.id === f.value || x.orderindex === Number(f.value));
  return { kind: 'field' as const, field: f, options, name: o?.name ?? 'No stage', color: o?.color ?? '#8b8b95', id: o?.id ?? '' };
}

/** The one custom field cards show so tasks with the same title can be told apart: the first dropdown or text field that has a value. */
export function noteOf(t: CuTask) {
  for (const f of t.custom_fields ?? []) {
    if (f.name === PROGRESS_FIELD || f.value == null || f.value === '') continue;
    if (f.type === 'drop_down') {
      const o = f.type_config?.options?.find((x) => x.id === f.value || x.orderindex === Number(f.value));
      if (o) return `${f.name}: ${o.name}`;
    } else if ((f.type === 'short_text' || f.type === 'text') && typeof f.value === 'string' && f.value.trim()) return `${f.name}: ${f.value.trim()}`;
  }
  return '';
}

export const isDone = (t: CuTask) => t.status.type === 'closed' || !!t.date_closed;
