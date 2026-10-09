'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAi } from '@/lib/ai';
import sharp from 'sharp';
import { removeAiImages, saveAiImage } from '@/lib/aiStorage';
import { db } from '@/lib/db';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const DEFAULT_CATEGORIES = ['Reel/Animation', 'Flyer', 'Photo Resize', 'Carousel', 'Story/IG Cover', 'Profile Logo'];
const refresh = () => { revalidatePath('/aireviewer', 'layout'); };

// ----- clients (the tool's own list, unrelated to Reyal Proof clients) -----
export async function createAiClient(f: FormData) {
  await requireAi('AI_CRITERIA');
  const name = str(f, 'name');
  if (!name) return;
  const c = await db.aiClient.create({
    data: { name, notes: str(f, 'notes') || null, categories: { create: DEFAULT_CATEGORIES.map((n, i) => ({ name: n, position: i })) } },
  });
  refresh();
  redirect(`/aireviewer/clients?c=${c.id}`);
}

export async function updateAiClient(f: FormData) {
  await requireAi('AI_CRITERIA');
  const name = str(f, 'name');
  if (!name) return;
  await db.aiClient.update({ where: { id: str(f, 'id') }, data: { name, notes: str(f, 'notes') || null } });
  refresh();
}

export async function deleteAiClient(f: FormData) {
  await requireAi('AI_CRITERIA');
  // Past reviews are kept (they hold their own copy of the client name), so nothing in History disappears.
  const gone = await db.aiClient.delete({ where: { id: str(f, 'id') } });
  if (gone.logoFile) await removeAiImages([gone.logoFile]);
  refresh();
  redirect('/aireviewer/clients');
}

// ----- client icon: resized to a 256px square so it is small, sharp and consistent -----
const ICON_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export async function setAiClientLogo(f: FormData) {
  await requireAi('AI_CRITERIA');
  const file = f.get('logo');
  if (!(file instanceof File) || !file.size || !ICON_TYPES.includes(file.type) || file.size > 2 * 1024 * 1024) return;
  const id = str(f, 'id');
  const client = await db.aiClient.findUnique({ where: { id } });
  if (!client) return;
  const png = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 50_000_000 })
    .rotate().resize(256, 256, { fit: 'cover' }).png().toBuffer();
  const logoFile = await saveAiImage(png, 'image/png');
  await db.aiClient.update({ where: { id }, data: { logoFile } });
  if (client.logoFile) await removeAiImages([client.logoFile]);
  refresh();
}
export async function removeAiClientLogo(f: FormData) {
  await requireAi('AI_CRITERIA');
  const client = await db.aiClient.findUnique({ where: { id: str(f, 'id') } });
  if (!client?.logoFile) return;
  await db.aiClient.update({ where: { id: client.id }, data: { logoFile: null } });
  await removeAiImages([client.logoFile]);
  refresh();
}

// ----- categories -----
export async function addAiCategory(f: FormData) {
  await requireAi('AI_CRITERIA');
  const name = str(f, 'name');
  if (!name) return;
  const clientId = str(f, 'clientId');
  const last = await db.aiCategory.aggregate({ where: { clientId }, _max: { position: true } });
  await db.aiCategory.create({ data: { clientId, name, position: (last._max.position ?? -1) + 1 } });
  refresh();
}
export async function renameAiCategory(f: FormData) {
  await requireAi('AI_CRITERIA');
  const name = str(f, 'name');
  if (!name) return;
  await db.aiCategory.update({ where: { id: str(f, 'id') }, data: { name } });
  refresh();
}
export async function deleteAiCategory(f: FormData) {
  await requireAi('AI_CRITERIA');
  await db.aiCategory.delete({ where: { id: str(f, 'id') } });
  refresh();
}

// ----- criteria: categoryId empty means "checked in every category of this client" -----
export async function addAiCriterion(f: FormData) {
  await requireAi('AI_CRITERIA');
  const text = str(f, 'text');
  if (!text) return;
  const clientId = str(f, 'clientId');
  const categoryId = str(f, 'categoryId') || null;
  const last = await db.aiCriterion.aggregate({ where: { clientId, categoryId }, _max: { position: true } });
  await db.aiCriterion.create({ data: { clientId, categoryId, text, position: (last._max.position ?? -1) + 1 } });
  refresh();
}
export async function updateAiCriterion(f: FormData) {
  await requireAi('AI_CRITERIA');
  const text = str(f, 'text');
  if (!text) return;
  await db.aiCriterion.update({ where: { id: str(f, 'id') }, data: { text } });
  refresh();
}
export async function deleteAiCriterion(f: FormData) {
  await requireAi('AI_CRITERIA');
  await db.aiCriterion.delete({ where: { id: str(f, 'id') } });
  refresh();
}
/** Swaps a criterion with its neighbour in the same list (direction: up or down). */
export async function moveAiCriterion(f: FormData) {
  await requireAi('AI_CRITERIA');
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
  await requireAi('AI_REVIEW');
  const r = await db.aiReview.delete({ where: { id: str(f, 'id') } });
  await removeAiImages([r.imageFile]);
  refresh();
}
export async function setAiVerdict(f: FormData) {
  await requireAi('AI_REVIEW');
  const verdict = str(f, 'verdict');
  if (!['approved', 'needs_review', 'rejected'].includes(verdict)) return;
  await db.aiReview.update({ where: { id: str(f, 'id') }, data: { verdict } });
  refresh();
}
