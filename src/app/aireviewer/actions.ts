'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAi } from '@/lib/ai';
import { removeAiImages } from '@/lib/aiStorage';
import { db } from '@/lib/db';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const DEFAULT_CATEGORIES = ['Reel/Animation', 'Flyer', 'Photo Resize', 'Carousel', 'Story/IG Cover', 'Profile Logo'];
const refresh = () => { revalidatePath('/aireviewer', 'layout'); };

// ----- clients (the tool's own list, unrelated to Reyal Proof clients) -----
export async function createAiClient(f: FormData) {
  await requireAi();
  const name = str(f, 'name');
  if (!name) return;
  const c = await db.aiClient.create({
    data: { name, notes: str(f, 'notes') || null, categories: { create: DEFAULT_CATEGORIES.map((n, i) => ({ name: n, position: i })) } },
  });
  refresh();
  redirect(`/aireviewer/clients?c=${c.id}`);
}

export async function updateAiClient(f: FormData) {
  await requireAi();
  const name = str(f, 'name');
  if (!name) return;
  await db.aiClient.update({ where: { id: str(f, 'id') }, data: { name, notes: str(f, 'notes') || null } });
  refresh();
}

export async function deleteAiClient(f: FormData) {
  await requireAi();
  // Past reviews are kept (they hold their own copy of the client name), so nothing in History disappears.
  await db.aiClient.delete({ where: { id: str(f, 'id') } });
  refresh();
  redirect('/aireviewer/clients');
}

// ----- categories -----
export async function addAiCategory(f: FormData) {
  await requireAi();
  const name = str(f, 'name');
  if (!name) return;
  const clientId = str(f, 'clientId');
  const last = await db.aiCategory.aggregate({ where: { clientId }, _max: { position: true } });
  await db.aiCategory.create({ data: { clientId, name, position: (last._max.position ?? -1) + 1 } });
  refresh();
}
export async function renameAiCategory(f: FormData) {
  await requireAi();
  const name = str(f, 'name');
  if (!name) return;
  await db.aiCategory.update({ where: { id: str(f, 'id') }, data: { name } });
  refresh();
}
export async function deleteAiCategory(f: FormData) {
  await requireAi();
  await db.aiCategory.delete({ where: { id: str(f, 'id') } });
  refresh();
}

// ----- criteria: categoryId empty means "checked in every category of this client" -----
export async function addAiCriterion(f: FormData) {
  await requireAi();
  const text = str(f, 'text');
  if (!text) return;
  const clientId = str(f, 'clientId');
  const categoryId = str(f, 'categoryId') || null;
  const last = await db.aiCriterion.aggregate({ where: { clientId, categoryId }, _max: { position: true } });
  await db.aiCriterion.create({ data: { clientId, categoryId, text, position: (last._max.position ?? -1) + 1 } });
  refresh();
}
export async function updateAiCriterion(f: FormData) {
  await requireAi();
  const text = str(f, 'text');
  if (!text) return;
  await db.aiCriterion.update({ where: { id: str(f, 'id') }, data: { text } });
  refresh();
}
export async function deleteAiCriterion(f: FormData) {
  await requireAi();
  await db.aiCriterion.delete({ where: { id: str(f, 'id') } });
  refresh();
}
/** Swaps a criterion with its neighbour in the same list (direction: up or down). */
export async function moveAiCriterion(f: FormData) {
  await requireAi();
  const c = await db.aiCriterion.findUnique({ where: { id: str(f, 'id') } });
  if (!c) return;
  const list = await db.aiCriterion.findMany({ where: { clientId: c.clientId, categoryId: c.categoryId }, orderBy: [{ position: 'asc' }, { id: 'asc' }] });
  const i = list.findIndex((x) => x.id === c.id);
  const j = str(f, 'dir') === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return;
  const next = list.slice();
  [next[i], next[j]] = [next[j], next[i]];
  await db.$transaction(next.map((x, pos) => db.aiCriterion.update({ where: { id: x.id }, data: { position: pos } })));
  refresh();
}

// ----- reviews -----
export async function deleteAiReview(f: FormData) {
  await requireAi();
  const r = await db.aiReview.delete({ where: { id: str(f, 'id') } });
  await removeAiImages([r.imageFile]);
  refresh();
}
export async function setAiVerdict(f: FormData) {
  await requireAi();
  const verdict = str(f, 'verdict');
  if (!['approved', 'needs_review', 'rejected'].includes(verdict)) return;
  await db.aiReview.update({ where: { id: str(f, 'id') }, data: { verdict } });
  refresh();
}
