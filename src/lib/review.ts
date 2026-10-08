import { cookies } from 'next/headers';
import { db } from './db';
import { isAdmin, safeEq, sign } from './auth';

export const reviewCookie = (slug: string) => `rp_${slug.slice(0, 12)}`;
export const reviewToken = (slug: string, password: string) => sign(`review:${slug}:${password}`);

export type Access = 'ok' | 'locked' | 'expired' | 'missing';

export async function loadProject(slug: string) {
  const project = await db.project.findUnique({ where: { slug }, include: { versions: { orderBy: { number: 'desc' } } } });
  if (!project) return { project: null, access: 'missing' as Access };
  if (await isAdmin()) return { project, access: 'ok' as Access };
  if (project.expiresAt && project.expiresAt < new Date()) return { project, access: 'expired' as Access };
  if (project.password) {
    const c = (await cookies()).get(reviewCookie(slug))?.value;
    if (!c || !safeEq(c, reviewToken(slug, project.password))) return { project, access: 'locked' as Access };
  }
  return { project, access: 'ok' as Access };
}
