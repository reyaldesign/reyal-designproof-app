'use server';

import { redirect } from 'next/navigation';
import { requireTool } from '@/lib/access';
import { cu, errorText } from '@/lib/clickup';
import { forget } from '@/lib/clickupData';
import { dueMs } from '@/lib/clickupView';
import { db } from '@/lib/db';
import { MAX_ATTACH_MB, MAX_UPLOAD_MB } from '@/lib/limits';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const back = (f: FormData) => { const b = str(f, 'back'); return b.startsWith('/clickup') ? b : '/clickup'; };
const task = (f: FormData) => encodeURIComponent(str(f, 'task'));
const put = (id: string, f: FormData, body: unknown) => cu(id, `/task/${task(f)}`, { method: 'PUT', body });

/** Runs one ClickUp call as the signed-in person, then returns to the page with an error note if it failed. */
async function go(f: FormData, fn: (userId: string) => Promise<unknown>) {
  const me = await requireTool('CLICKUP');
  const to = back(f);
  let error = '';
  try { await fn(me.id); forget(me.id); } catch (e) { error = errorText(e); }
  redirect(error ? `${to}${to.includes('?') ? '&' : '?'}error=${encodeURIComponent(error)}` : to);
}
/** Why these files cannot be attached, or '' when they are fine. */
const fileProblem = (files: File[]) => {
  const big = files.find((x) => x.size > MAX_ATTACH_MB * 1048576);
  if (big) return `"${big.name}" is over ${MAX_ATTACH_MB} MB. Attach a smaller file or share a link instead.`;
  return files.reduce((n, x) => n + x.size, 0) > MAX_UPLOAD_MB * 1048576 ? `Attachments can total ${MAX_UPLOAD_MB} MB at most.` : '';
};
/** Uploads each file to the task. Returns the names that failed, so one bad file does not hide the rest. */
async function attachAll(userId: string, taskId: string, files: File[]) {
  const failed: string[] = [];
  for (const file of files) {
    const form = new FormData();
    form.append('attachment', file, file.name);
    try { await cu(userId, `/task/${encodeURIComponent(taskId)}/attachment`, { method: 'POST', form }); } catch { failed.push(file.name); }
  }
  return failed;
}
const pickFiles = (f: FormData) => f.getAll('files').filter((x): x is File => x instanceof File && x.size > 0);

const fail = (f: FormData, message: string) => go(f, async () => { throw new Error(message); });

/** The popup's "Create task". Returns an error to show in the popup, or moves on to the board once the task exists. */
export async function createTask(_: { error?: string } | null, f: FormData): Promise<{ error?: string }> {
  const me = await requireTool('CLICKUP');
  const title = str(f, 'title'), list = str(f, 'list'), stage = str(f, 'stage'), stageField = str(f, 'stageField');
  const noteField = str(f, 'noteField'), note = str(f, 'note'), due = str(f, 'due'), priority = str(f, 'priority');
  if (!title || !list) return { error: 'Enter a task name.' };
  const files = pickFiles(f);
  if (fileProblem(files)) return { error: fileProblem(files) };
  const assignees = f.getAll('assignee').map(Number).filter(Boolean), tags = f.getAll('tag').map(String).filter(Boolean);
  const custom = [...(stageField && stage ? [{ id: stageField, value: stage }] : []), ...(noteField && note ? [{ id: noteField, value: note }] : [])];
  const body = {
    name: title,
    ...(str(f, 'desc') ? { description: str(f, 'desc') } : {}),
    ...(stage && !stageField ? { status: stage } : {}),
    ...(custom.length ? { custom_fields: custom } : {}),
    ...(due ? { due_date: dueMs(due) } : {}),
    ...(priority ? { priority: Number(priority) } : {}),
    ...(assignees.length ? { assignees } : {}),
    ...(tags.length ? { tags } : {}),
  };
  let id = '';
  try { id = (await cu<{ id: string }>(me.id, `/list/${encodeURIComponent(list)}/task`, { method: 'POST', body })).id; } catch (e) { return { error: errorText(e) }; }
  // The task exists now. If a file fails, say so on the next page rather than hiding that the task was made.
  forget(me.id);
  const failed = await attachAll(me.id, id, files);
  const how = str(f, 'how'), at = `/clickup?list=${encodeURIComponent(list)}`;
  const warn = failed.length ? `&error=${encodeURIComponent(`Task created, but ${failed.length === 1 ? 'this file' : 'these files'} could not be attached: ${failed.join(', ')}`)}` : '';
  redirect(how === 'another' ? `${at}&new=1&n=${Date.now()}${warn}` : how === 'open' ? `${at}&task=${id}${warn}` : `${at}${warn}`);
}

export async function setProgress(f: FormData) {
  const field = encodeURIComponent(str(f, 'field')), value = str(f, 'value');
  if (!field) return go(f, (id) => put(id, f, { status: value }));
  if (!value) return go(f, (id) => cu(id, `/task/${task(f)}/field/${field}`, { method: 'DELETE' }));
  return go(f, (id) => cu(id, `/task/${task(f)}/field/${field}`, { method: 'POST', body: { value } }));
}

export async function setDue(f: FormData) {
  const d = str(f, 'due');
  return go(f, (id) => put(id, f, { due_date: d ? dueMs(d) : null }));
}

export async function setPriority(f: FormData) {
  const p = str(f, 'priority');
  return go(f, (id) => put(id, f, { priority: p ? Number(p) : null }));
}

/** mode is "add" or "rem". */
export async function assignee(f: FormData) {
  const mode = str(f, 'mode') === 'rem' ? 'rem' : 'add';
  return go(f, (id) => put(id, f, { assignees: { [mode]: [Number(str(f, 'user'))] } }));
}

export async function setTitle(f: FormData) {
  const name = str(f, 'title');
  if (!name) return fail(f, 'A task needs a title.');
  return go(f, (id) => put(id, f, { name }));
}

export async function addComment(f: FormData) {
  const text = str(f, 'text');
  if (!text) return fail(f, 'Write a comment first.');
  return go(f, (id) => cu(id, `/task/${task(f)}/comment`, { method: 'POST', body: { comment_text: text } }));
}

/** The paperclip beside the comment box: attaches the chosen files to the open task. */
export async function addAttachment(f: FormData) {
  const me = await requireTool('CLICKUP');
  const files = pickFiles(f), to = back(f), sep = to.includes('?') ? '&' : '?';
  let error = fileProblem(files);
  if (!error && files.length) {
    const failed = await attachAll(me.id, str(f, 'task'), files);
    forget(me.id);
    if (failed.length) error = `Could not attach: ${failed.join(', ')}`;
  }
  redirect(error ? `${to}${sep}error=${encodeURIComponent(error)}` : to);
}

export async function disconnect() {
  const me = await requireTool('CLICKUP');
  await db.clickupToken.deleteMany({ where: { userId: me.id } });
  forget(me.id, true);
  redirect('/clickup');
}
