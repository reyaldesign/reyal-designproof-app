'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { MAX_IMAGE_MB, MAX_PDF_MB, MAX_UPLOAD_MB } from '@/lib/limits';
import { saveImages } from '@/lib/storage';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const files = (f: FormData) => f.getAll('files').filter((x): x is File => x instanceof File && x.size > 0);
const date = (s: string) => (s ? new Date(`${s}T23:59:59`) : null);

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
  await requireAdmin();
  const name = str(f, 'name');
  if (!name) redirect('/admin?error=Enter a client name.');
  const c = await db.client.create({ data: { name, email: str(f, 'email') || null, notes: str(f, 'notes') || null } });
  redirect(`/admin/clients/${c.id}`);
}

export async function deleteClient(f: FormData) {
  await requireAdmin();
  await db.client.delete({ where: { id: str(f, 'id') } });
  redirect('/admin');
}

export async function createProject(f: FormData) {
  await requireAdmin();
  const clientId = str(f, 'clientId');
  const { rows: images, error } = await imageRows(f);
  const fail = (msg: string) => redirect(`/admin/clients/${clientId}?error=${encodeURIComponent(msg)}`);
  if (!str(f, 'title')) fail('Enter a proof title.');
  if (error) fail(error);
  const p = await db.project.create({
    data: {
      slug: randomBytes(16).toString('base64url'),
      title: str(f, 'title'),
      clientId,
      password: str(f, 'password') || null,
      expiresAt: date(str(f, 'expires')),
      versions: { create: { number: 1, label: str(f, 'label') || 'Version 1', images: { create: images } } },
    },
  });
  redirect(`/admin/${p.id}`);
}

export async function updateProject(f: FormData) {
  await requireAdmin();
  const id = str(f, 'id');
  await db.project.update({
    where: { id },
    data: {
      title: str(f, 'title'),
      status: str(f, 'status'),
      ...(str(f, 'status') !== 'Approved' && { approvedAt: null, approvedBy: null, approvedVersion: null }),
      password: str(f, 'password') || null,
      expiresAt: date(str(f, 'expires')),
    },
  });
  revalidatePath(`/admin/${id}`);
}

export async function addVersion(f: FormData) {
  await requireAdmin();
  const projectId = str(f, 'projectId');
  const { rows: images, error } = await imageRows(f);
  if (error) redirect(`/admin/${projectId}?error=${encodeURIComponent(error)}`);
  const last = await db.version.findFirst({ where: { projectId }, orderBy: { number: 'desc' } });
  const number = (last?.number ?? 0) + 1;
  await db.version.create({ data: { projectId, number, label: str(f, 'label') || `Version ${number}`, images: { create: images } } });
  await db.project.update({ where: { id: projectId }, data: { status: 'Sent', approvedAt: null, approvedBy: null, approvedVersion: null } });
  revalidatePath(`/admin/${projectId}`);
}

export async function setResolved(f: FormData) {
  await requireAdmin();
  const c = await db.comment.update({ where: { id: str(f, 'id') }, data: { resolved: str(f, 'resolved') === '1' }, include: { version: true } });
  revalidatePath(`/admin/${c.version.projectId}`);
}

export async function replyTo(f: FormData) {
  await requireAdmin();
  const parent = await db.comment.findUniqueOrThrow({ where: { id: str(f, 'id') }, include: { version: true } });
  const text = str(f, 'text').slice(0, 4000);
  if (!text) return;
  await db.comment.create({
    data: { versionId: parent.versionId, imageId: parent.imageId, parentId: parent.id, author: 'Reyal Design', text, fromDesigner: true },
  });
  revalidatePath(`/admin/${parent.version.projectId}`);
}

export async function reopenApproval(f: FormData) {
  await requireAdmin();
  const id = str(f, 'id');
  await db.project.update({ where: { id }, data: { status: 'Sent', approvedAt: null, approvedBy: null, approvedVersion: null } });
  revalidatePath(`/admin/${id}`);
}

export async function deleteProject(f: FormData) {
  await requireAdmin();
  const p = await db.project.delete({ where: { id: str(f, 'id') } });
  redirect(`/admin/clients/${p.clientId}`);
}

export async function logout() {
  (await cookies()).delete('rp_admin');
  (await cookies()).delete('rp_user');
  redirect('/login');
}
