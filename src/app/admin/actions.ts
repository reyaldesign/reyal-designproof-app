'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireTool } from '@/lib/access';
import { signOut } from '@/lib/access';
import { db } from '@/lib/db';
import { discoverPages, figmaConfigured, parseFigmaUrl } from '@/lib/figma';
import { prefetchStartFrames } from '@/lib/figmaFrames';
import { cleanLiveUrl } from '@/lib/live';
import { MAX_IMAGE_MB, MAX_PDF_MB, MAX_UPLOAD_MB } from '@/lib/limits';
import { removeUploads, saveImages } from '@/lib/storage';
import { isProofType } from '@/lib/types';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const files = (f: FormData) => f.getAll('files').filter((x): x is File => x instanceof File && x.size > 0);
const date = (s: string) => (s ? new Date(`${s}T23:59:59`) : null);
const BAD_URL = 'Enter the address of the live site, for example https://staging.example.com';
const BAD_FIGMA = 'Paste a Figma prototype link (it starts with figma.com/proto) for at least one screen size.';
/** The Figma prototype links from the form: one per screen size, any of them may be empty. Returns the JSON to store, or an error. */
async function figmaFrom(f: FormData): Promise<{ json: string } | { error: string }> {
  if (!figmaConfigured()) return { error: 'Figma is not set up on this server yet (FIGMA_TOKEN and FIGMA_CLIENT_ID).' };
  const out: Record<string, unknown> = {};
  for (const [key, field] of [['desktop', 'figmaDesktop'], ['tablet', 'figmaTablet'], ['mobile', 'figmaMobile']] as const) {
    const v = str(f, field);
    if (!v) continue;
    const link = parseFigmaUrl(v);
    if (!link) return { error: `The ${key} link is not a Figma prototype link. ${BAD_FIGMA}` };
    // Each size's screens are found now, so the review page can list them. If Figma cannot be reached, the start screen alone is used.
    out[key] = { ...link, pages: await discoverPages(link).catch(() => []) };
  }
  return Object.keys(out).length ? { json: JSON.stringify(out) } : { error: BAD_FIGMA };
}
/** Screenshot files left on a live site proof's comments, so they are deleted with it. */
const shotsOf = async (where: object) => (await db.comment.findMany({ where: { shot: { not: null }, ...where }, select: { shot: true } })).map((c) => c.shot!);

/** Saves the uploaded files. Returns the rows, or an error message the page can show. */
async function imageRows(f: FormData, start = 0): Promise<{ rows: { file: string; position: number }[]; error?: string }> {
  const picked = files(f);
  const totalMb = picked.reduce((n, x) => n + x.size, 0) / 1048576;
  if (totalMb > MAX_UPLOAD_MB) return { rows: [], error: `That upload is ${totalMb.toFixed(0)} MB. Keep each upload under ${MAX_UPLOAD_MB} MB and export web-sized previews, not final artwork.` };
  try {
    const names = await saveImages(picked);
    if (!names.length) {
      return { rows: [], error: picked.length ? `None of those files could be used. Use JPG, PNG, WebP or GIF (up to ${MAX_IMAGE_MB} MB each) or a readable PDF (up to ${MAX_PDF_MB} MB, not password protected).` : 'Choose at least one image or PDF.' };
    }
    return { rows: names.map((file, i) => ({ file, position: start + i })) };
  } catch (e) {
    console.error('upload failed', e);
    return { rows: [], error: 'The server could not save the upload. Please try again, and tell the admin if it keeps happening.' };
  }
}

export async function createClient(f: FormData) {
  await requireTool('PROOFS');
  const name = str(f, 'name');
  if (!name) redirect('/admin?error=Enter a client name.');
  const c = await db.client.create({ data: { name, email: str(f, 'email') || null, notes: str(f, 'notes') || null } });
  redirect(`/admin/clients/${c.id}`);
}

const revisions = (v: string) => Math.min(20, Math.max(0, Math.round(Number(v)) || 0));

export async function updateClient(f: FormData) {
  await requireTool('PROOFS');
  const id = str(f, 'id');
  const name = str(f, 'name');
  if (!name) redirect(`/admin/clients/${id}?error=${encodeURIComponent('Enter a client name.')}`);
  await db.client.update({
    where: { id },
    data: { name, email: str(f, 'email') || null, notes: str(f, 'notes') || null, revisionsIncluded: revisions(str(f, 'revisionsIncluded')) },
  });
  revalidatePath(`/admin/clients/${id}`);
  revalidatePath('/admin');
}

export async function deleteClient(f: FormData) {
  await requireTool('PROOFS');
  const id = str(f, 'id');
  const files = [...(await db.image.findMany({ where: { version: { project: { clientId: id } } }, select: { file: true } })).map((i) => i.file), ...(await shotsOf({ version: { project: { clientId: id } } }))];
  await db.client.delete({ where: { id } });
  await removeUploads(files);
  redirect('/admin');
}

export async function createProject(f: FormData) {
  await requireTool('PROOFS');
  const clientId = str(f, 'clientId');
  const fail = (msg: string) => redirect(`/admin/clients/${clientId}?error=${encodeURIComponent(msg)}`);
  const liveUrl = str(f, 'source') === 'live' ? cleanLiveUrl(str(f, 'liveUrl')) : null;
  if (str(f, 'source') === 'live' && !liveUrl) fail(BAD_URL);
  const fig = str(f, 'source') === 'figma' ? await figmaFrom(f) : null;
  if (fig && 'error' in fig) fail(fig.error);
  const figma = fig && 'json' in fig ? fig.json : null;
  if (!str(f, 'title')) fail('Enter a proof title.');
  if (!isProofType(str(f, 'type'))) fail('Choose what type of proof this is.');
  const { rows: images, error } = liveUrl || figma ? { rows: [], error: undefined } : await imageRows(f);
  if (error) fail(error);
  const p = await db.project.create({
    data: {
      slug: randomBytes(16).toString('base64url'),
      title: str(f, 'title'),
      type: str(f, 'type'),
      clientId,
      password: str(f, 'password') || null,
      expiresAt: date(str(f, 'expires')),
      versions: { create: { number: 1, label: str(f, 'label') || 'Version 1', liveUrl, figma, images: { create: images } } },
    },
    include: { versions: { select: { id: true } } },
  });
  if (figma) prefetchStartFrames(p.versions[0].id, figma);
  redirect(`/admin/${p.id}`);
}

export async function updateProject(f: FormData) {
  await requireTool('PROOFS');
  const id = str(f, 'id');
  await db.project.update({
    where: { id },
    data: {
      title: str(f, 'title'),
      ...(['Draft', 'Sent', 'Feedback Received', 'Approved'].includes(str(f, 'status')) && { status: str(f, 'status') }),
      type: isProofType(str(f, 'type')) ? str(f, 'type') : null,
      revisionsIncluded: str(f, 'revisionsIncluded') === '' ? null : revisions(str(f, 'revisionsIncluded')),
      ...(str(f, 'status') !== 'Approved' && str(f, 'status') !== '' && { approvedAt: null, approvedBy: null, approvedVersion: null }),
      password: str(f, 'password') || null,
      expiresAt: date(str(f, 'expires')),
    },
  });
  revalidatePath(`/admin/${id}`);
}

export async function addVersion(f: FormData) {
  await requireTool('PROOFS');
  const projectId = str(f, 'projectId');
  const liveUrl = str(f, 'source') === 'live' ? cleanLiveUrl(str(f, 'liveUrl')) : null;
  if (str(f, 'source') === 'live' && !liveUrl) redirect(`/admin/${projectId}?error=${encodeURIComponent(BAD_URL)}`);
  const fig = str(f, 'source') === 'figma' ? await figmaFrom(f) : null;
  if (fig && 'error' in fig) redirect(`/admin/${projectId}?error=${encodeURIComponent(fig.error)}`);
  const figma = fig && 'json' in fig ? fig.json : null;
  const { rows: images, error } = liveUrl || figma ? { rows: [], error: undefined } : await imageRows(f);
  if (error) redirect(`/admin/${projectId}?error=${encodeURIComponent(error)}`);
  const last = await db.version.findFirst({ where: { projectId }, orderBy: { number: 'desc' } });
  const number = (last?.number ?? 0) + 1;
  const created = await db.version.create({ data: { projectId, number, label: str(f, 'label') || `Version ${number}`, liveUrl, figma, images: { create: images } } });
  if (figma) prefetchStartFrames(created.id, figma);
  await db.project.update({ where: { id: projectId }, data: { status: 'Sent', approvedAt: null, approvedBy: null, approvedVersion: null } });
  revalidatePath(`/admin/${projectId}`);
}

export async function setResolved(f: FormData) {
  await requireTool('PROOFS');
  const c = await db.comment.update({ where: { id: str(f, 'id') }, data: { resolved: str(f, 'resolved') === '1' }, include: { version: true } });
  revalidatePath(`/admin/${c.version.projectId}`);
}

export async function replyTo(f: FormData) {
  await requireTool('PROOFS');
  const parent = await db.comment.findUniqueOrThrow({ where: { id: str(f, 'id') }, include: { version: true } });
  const text = str(f, 'text').slice(0, 4000);
  if (!text) return;
  await db.comment.create({
    data: { versionId: parent.versionId, imageId: parent.imageId, parentId: parent.id, author: 'Reyal Design', text, fromDesigner: true },
  });
  revalidatePath(`/admin/${parent.version.projectId}`);
}

/** Marks the proof as sent after the designer copies the link or opens the email draft. Nothing is emailed from here. */
export async function markSent(f: FormData) {
  await requireTool('PROOFS');
  const id = str(f, 'id');
  const p = await db.project.findUniqueOrThrow({ where: { id } });
  if (p.status === 'Draft') await db.project.update({ where: { id }, data: { status: 'Sent' } });
  revalidatePath(`/admin/${id}`);
}

export async function reopenApproval(f: FormData) {
  await requireTool('PROOFS');
  const id = str(f, 'id');
  await db.project.update({ where: { id }, data: { status: 'Sent', approvedAt: null, approvedBy: null, approvedVersion: null } });
  revalidatePath(`/admin/${id}`);
}

export async function deleteProject(f: FormData) {
  await requireTool('PROOFS');
  const id = str(f, 'id');
  const files = [...(await db.image.findMany({ where: { version: { projectId: id } }, select: { file: true } })).map((i) => i.file), ...(await shotsOf({ version: { projectId: id } }))];
  const p = await db.project.delete({ where: { id } });
  await removeUploads(files);
  redirect(`/admin/clients/${p.clientId}`);
}

export async function logout() {
  await signOut();
  redirect('/login');
}
