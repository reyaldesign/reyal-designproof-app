'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { saveImages } from '@/lib/storage';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const files = (f: FormData) => f.getAll('files').filter((x): x is File => x instanceof File && x.size > 0);
const date = (s: string) => (s ? new Date(`${s}T23:59:59`) : null);

async function imageRows(f: FormData, start = 0) {
  const names = await saveImages(files(f));
  return names.map((file, i) => ({ file, position: start + i }));
}

export async function createProject(f: FormData) {
  await requireAdmin();
  const images = await imageRows(f);
  if (!str(f, 'title') || !images.length) redirect('/admin?error=Add a title and at least one image (JPG, PNG, WebP or GIF).');
  const p = await db.project.create({
    data: {
      slug: randomBytes(16).toString('base64url'),
      title: str(f, 'title'),
      client: str(f, 'client'),
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
      client: str(f, 'client'),
      status: str(f, 'status'),
      password: str(f, 'password') || null,
      expiresAt: date(str(f, 'expires')),
    },
  });
  revalidatePath(`/admin/${id}`);
}

export async function addVersion(f: FormData) {
  await requireAdmin();
  const projectId = str(f, 'projectId');
  const images = await imageRows(f);
  if (!images.length) redirect(`/admin/${projectId}`);
  const last = await db.version.findFirst({ where: { projectId }, orderBy: { number: 'desc' } });
  const number = (last?.number ?? 0) + 1;
  await db.version.create({ data: { projectId, number, label: str(f, 'label') || `Version ${number}`, images: { create: images } } });
  await db.project.update({ where: { id: projectId }, data: { status: 'Sent' } });
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

export async function deleteProject(f: FormData) {
  await requireAdmin();
  await db.project.delete({ where: { id: str(f, 'id') } });
  redirect('/admin');
}

export async function logout() {
  (await cookies()).delete('rp_admin');
  redirect('/login');
}
