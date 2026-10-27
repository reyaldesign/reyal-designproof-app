'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireTool } from '@/lib/access';
import { db } from '@/lib/db';
import { runChecks } from '@/lib/websiteMonitor';
import { FIELDS, cleanUrl, parseCsv, siteKey, type FieldKey } from '@/lib/websitesShared';

export type FormState = { error?: string; ok?: string; values?: Record<string, string> } | null;
const refresh = () => { revalidatePath('/websites', 'layout'); };

/** The form's fields as clean strings. The address must be a web address when it is filled in. */
function readFields(f: FormData): { data: Record<FieldKey, string>; error?: string } {
  const data = {} as Record<FieldKey, string>;
  for (const { key } of FIELDS) data[key] = String(f.get(key) ?? '').trim().slice(0, 300);
  if (!data.clientName) return { data, error: 'Enter the client name.' };
  const typed = data.url;
  data.url = cleanUrl(typed);
  if (typed && !data.url) return { data, error: 'That website link does not look like a web address.' };
  if (data.status.toLowerCase() === 'live' && !data.url) return { data, error: 'A Live website needs a link so it can be checked.' };
  return { data };
}

export async function saveWebsite(_: FormState, f: FormData): Promise<FormState> {
  await requireTool('WEBSITES');
  const { data, error } = readFields(f);
  if (error) return { error, values: { ...data, url: String(f.get('url') ?? '').trim() } }; // what was typed comes back, because the form resets after every submit
  const id = String(f.get('id') ?? '');
  if (id) {
    await db.website.update({ where: { id }, data });
  } else {
    const last = await db.website.aggregate({ _max: { position: true } });
    const created = await db.website.create({ data: { ...data, position: (last._max.position ?? -1) + 1 } });
    if (data.status.toLowerCase() === 'live') runChecks([created.id]).catch(() => {}); // first reading right away
  }
  refresh();
  return { ok: id ? 'Saved.' : 'Added.' };
}

export async function deleteWebsite(f: FormData) {
  await requireTool('WEBSITES');
  await db.website.delete({ where: { id: String(f.get('id') ?? '') } }).catch(() => {}); // its check history goes with it
  refresh();
  redirect('/websites');
}

/** One site now, and the answer is waiting when this returns. */
export async function checkOne(f: FormData) {
  await requireTool('WEBSITES');
  await runChecks([String(f.get('id') ?? '')]);
  refresh();
}
/** Every Live site. It runs in the background, because it can take a minute, and the page refreshes itself afterwards. */
export async function checkAll() {
  await requireTool('WEBSITES');
  runChecks().catch(() => {});
}

/** Adds the rows of a CSV file, matched by column name, skipping sites whose link is already in the list. */
export async function importCsv(_: FormState, f: FormData): Promise<FormState> {
  await requireTool('WEBSITES');
  const file = f.get('file');
  if (!(file instanceof File) || !file.size) return { error: 'Choose a CSV file.' };
  if (file.size > 2 * 1024 * 1024) return { error: 'That file is over 2 MB.' };
  const rows = parseCsv(await file.text());
  const head = (rows.shift() ?? []).map((h) => h.trim().toLowerCase());
  const col = Object.fromEntries(FIELDS.map((x) => [x.key, head.indexOf(x.csv.toLowerCase())])) as Record<FieldKey, number>;
  if (col.clientName < 0 || col.url < 0) return { error: 'The first row must be the column names, including Client Name and Website Link.' };

  const have = await db.website.findMany({ select: { url: true, clientName: true } });
  const seen = new Set(have.map((w) => (w.url ? siteKey(w.url) : `name:${w.clientName.trim().toLowerCase()}`)));
  let position = ((await db.website.aggregate({ _max: { position: true } }))._max.position ?? -1) + 1;
  let added = 0, skipped = 0;
  const batch = [];
  for (const r of rows) {
    const get = (k: FieldKey) => (col[k] >= 0 ? (r[col[k]] ?? '').trim().slice(0, 300) : '');
    const clientName = get('clientName');
    if (!clientName) continue;
    const url = cleanUrl(get('url'));
    const key = url ? siteKey(url) : `name:${clientName.toLowerCase()}`;
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);
    const data = Object.fromEntries(FIELDS.map((x) => [x.key, get(x.key)])) as Record<FieldKey, string>;
    batch.push({ ...data, clientName, url, position: position++ });
    added++;
  }
  if (batch.length) await db.$transaction(batch.map((data) => db.website.create({ data })));
  refresh();
  if (added) runChecks().catch(() => {}); // first readings for the new Live sites
  return { ok: `Added ${added} website${added === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} already in the list` : ''}.` };
}
