import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cookieOpts, safeEq } from '@/lib/auth';
import { db } from '@/lib/db';
import { loadProject, reviewCookie, reviewToken } from '@/lib/review';
import { revisionInfo } from '@/lib/revisions';
import ReviewClient from './ReviewClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Design review' };

async function unlock(f: FormData) {
  'use server';
  const slug = String(f.get('slug'));
  const p = await db.project.findUnique({ where: { slug } });
  if (!p?.password || !safeEq(String(f.get('password') ?? ''), p.password)) redirect(`/review/${slug}?bad=1`);
  (await cookies()).set(reviewCookie(slug), reviewToken(slug, p.password), cookieOpts);
  redirect(`/review/${slug}`);
}

const Notice = ({ children }: { children: React.ReactNode }) => (
  <main className="mx-auto mt-32 w-full max-w-sm px-4 text-center text-zinc-300">{children}</main>
);

export default async function Review({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ v?: string; bad?: string }>;
}) {
  const { slug } = await params;
  const { v, bad } = await searchParams;
  const { project, access } = await loadProject(slug);
  if (!project) notFound();
  if (access === 'expired') return <Notice>This review link has expired. Please ask Reyal Design for a new one.</Notice>;
  if (access === 'locked')
    return (
      <Notice>
        <h1 className="mb-4 text-lg font-semibold text-white">{project.title}</h1>
        <form action={unlock} className="card space-y-3 text-left">
          <input type="hidden" name="slug" value={slug} />
          <input className="input" type="password" name="password" placeholder="Password" autoFocus required />
          {bad && <p className="text-sm text-red-400">Wrong password.</p>}
          <button className="btn w-full">Open proof</button>
        </form>
      </Notice>
    );

  const version = project.versions.find((x) => String(x.number) === v) ?? project.versions[0];
  const data = await db.version.findUniqueOrThrow({
    where: { id: version.id },
    include: { images: { orderBy: { position: 'asc' } }, comments: { orderBy: { createdAt: 'asc' } } },
  });
  const rev = await revisionInfo(project.id);
  return (
    <ReviewClient
      slug={slug}
      title={project.title}
      client={project.client.name}
      approval={project.approvedVersion != null ? { by: project.approvedBy ?? '', at: project.approvedAt?.toISOString() ?? '', version: project.approvedVersion } : null}
      latest={project.versions[0].number}
      revisions={{ used: rev.used, included: rev.included }}
      versions={project.versions.map((x) => ({ number: x.number, label: x.label }))}
      current={{ id: data.id, number: data.number, label: data.label }}
      images={data.images.map((i) => ({ id: i.id, file: i.file }))}
      comments={data.comments.map((c) => ({
        id: c.id, imageId: c.imageId, parentId: c.parentId, author: c.author, text: c.text, x: c.x, y: c.y,
        pin: c.pin, resolved: c.resolved, fromDesigner: c.fromDesigner, createdAt: c.createdAt.toISOString(),
      }))}
    />
  );
}
