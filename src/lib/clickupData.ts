import { cu, type CuField, type CuStatus, type CuTask, type CuUser } from './clickup';
import { SPACE_ID, TEAM_ID, isLate } from './clickupView';

// ClickUp allows about 100 requests a minute per person, so slow-changing things are kept for a few minutes.
// On globalThis so server actions and pages share one cache, however the server bundles them.
const g = globalThis as unknown as { cuKept?: Map<string, { at: number; v: unknown }> };
const kept = g.cuKept ?? (g.cuKept = new Map());
async function keep<T>(key: string, ms: number, fn: () => Promise<T>): Promise<T> {
  const hit = kept.get(key);
  if (hit && Date.now() - hit.at < ms) return hit.v as T;
  const v = await fn();
  kept.set(key, { at: Date.now(), v });
  return v;
}

/** After a change: the lists that show counts and "mine" are refetched on the next read, but the old value stays readable for the sidebar badge meanwhile. all=true (disconnect) drops everything for this person. */
export function forget(u: string, all = false) {
  for (const [k, e] of kept) {
    if (k.split(':')[1] !== u) continue;
    if (all) kept.delete(k);
    else if (/^(mine|nav|tree|folder)/.test(k)) e.at = 0;
  }
}

export type Named = { id: string; name: string; task_count?: number | string; private?: boolean };
export type Folder = Named & { lists: Named[] };

export const whoAmI = (u: string) => keep(`me:${u}`, 600_000, async () => (await cu<{ user: CuUser }>(u, '/user')).user);

/** Every space in the workspace. */
export const allSpaces = (u: string) => keep(`spaces:${u}`, 300_000, async () => (await cu<{ spaces: Named[] }>(u, `/team/${TEAM_ID}/space?archived=false`)).spaces);

/** One space's folders and lists, with open task counts. */
export const spaceTree = (u: string, space = SPACE_ID) => keep(`tree:${u}:${space}`, 300_000, async () => {
  const [{ folders }, { lists }] = await Promise.all([
    cu<{ folders: Folder[] }>(u, `/space/${encodeURIComponent(space)}/folder?archived=false`),
    cu<{ lists: Named[] }>(u, `/space/${encodeURIComponent(space)}/list?archived=false`),
  ]);
  return { folders, loose: lists };
});

/** The other lists in a folder, shown as tabs. */
export const folderLists = (u: string, folder: string) => keep(`folder:${u}:${folder}`, 300_000, async () => (await cu<{ lists: Named[] }>(u, `/folder/${encodeURIComponent(folder)}/list?archived=false`)).lists);

export const listMeta = (u: string, id: string) => keep(`list:${u}:${id}`, 300_000, () => cu<{ name: string; statuses: CuStatus[]; space?: { id: string; name: string }; folder?: { id: string; name: string; hidden?: boolean } }>(u, `/list/${encodeURIComponent(id)}`));
export const listFields = (u: string, id: string) => keep(`fields:${u}:${id}`, 300_000, async () => (await cu<{ fields: CuField[] }>(u, `/list/${encodeURIComponent(id)}/field`)).fields);

type Page = { tasks: CuTask[]; last_page?: boolean };
/** Reads pages of 100 until the end, or until cap tasks, so one screen cannot use up the request limit. */
async function pages(u: string, path: string, cap: number) {
  const out: CuTask[] = [];
  for (let page = 0; out.length < cap; page++) {
    const r = await cu<Page>(u, `${path}${path.includes('?') ? '&' : '?'}page=${page}`);
    out.push(...r.tasks);
    if (r.last_page !== false || !r.tasks.length) break;
  }
  return out.slice(0, cap);
}

export const listTasks = (u: string, listId: string) => pages(u, `/list/${encodeURIComponent(listId)}/task?subtasks=true&include_closed=true`, 500);

/** Tasks across the Fulfillment space. */
export function spaceTasks(u: string, o: { assignee?: number; closed?: boolean; from?: number; to?: number; cap?: number } = {}) {
  const q = new URLSearchParams({ order_by: 'due_date', subtasks: 'true', include_closed: String(!!o.closed) });
  q.append('space_ids[]', SPACE_ID);
  if (o.assignee) q.append('assignees[]', String(o.assignee));
  if (o.from) q.set('due_date_gt', String(o.from));
  if (o.to) q.set('due_date_lt', String(o.to));
  return pages(u, `/team/${TEAM_ID}/task?${q}`, o.cap ?? 500);
}

/** Everything open that is assigned to this person, across every space and list. */
export const myOpenTasks = (u: string) => keep(`mine:${u}`, 60_000, async () => {
  const who = await whoAmI(u);
  const q = new URLSearchParams({ order_by: 'due_date', subtasks: 'true', include_closed: 'false' });
  q.append('assignees[]', String(who.id));
  return pages(u, `/team/${TEAM_ID}/task?${q}`, 500);
});

/** The red number beside Tasks in the app sidebar. Reads what the Tasks pages already loaded, so no page waits on ClickUp for it. */
export function overdueBadge(u: string) {
  const hit = kept.get(`mine:${u}`);
  return hit ? (hit.v as CuTask[]).filter(isLate).length : 0;
}

// ----- the ClickUp panel: every space, folder and list, with open counts and an overdue flag -----
export type NavList = { id: string; name: string; open: number; late: boolean };
export type NavFolder = { id: string; name: string; lists: NavList[] };
export type NavSpace = { id: string; name: string; isPrivate: boolean; loose: NavList[]; folders: NavFolder[] };
export type Nav = { spaces: NavSpace[]; mine: number; mineLate: number; at: number };

export const navData = (u: string) => keep(`nav:${u}`, 180_000, async (): Promise<Nav> => {
  const spaces = await allSpaces(u);
  const [trees, mine, overdue] = await Promise.all([
    Promise.all(spaces.map((s) => spaceTree(u, s.id))),
    myOpenTasks(u),
    pages(u, `/team/${TEAM_ID}/task?due_date_lt=${Date.now()}&include_closed=false&subtasks=true&order_by=due_date`, 500),
  ]);
  const late = new Set(overdue.filter(isLate).map((t) => t.list.id));
  const row = (l: Named): NavList => ({ id: l.id, name: l.name, open: Number(l.task_count) || 0, late: late.has(l.id) });
  return {
    spaces: spaces.map((s, i) => ({ id: s.id, name: s.name, isPrivate: !!s.private, loose: trees[i].loose.map(row), folders: trees[i].folders.map((f) => ({ id: f.id, name: f.name, lists: f.lists.map(row) })) })),
    mine: mine.length, mineLate: mine.filter(isLate).length, at: Date.now(),
  };
});

/** People who can be assigned on a list. */
export const listMembers = (u: string, listId: string) => keep(`members:${u}:${listId}`, 300_000, async () => (await cu<{ members: CuUser[] }>(u, `/list/${encodeURIComponent(listId)}/member`)).members);

/** Tag names that exist in a space. */
export const spaceTags = (u: string, spaceId: string) => keep(`tags:${u}:${spaceId}`, 300_000, async () => (await cu<{ tags: { name: string }[] }>(u, `/space/${encodeURIComponent(spaceId)}/tag`)).tags.map((t) => t.name));
