import { cookies } from 'next/headers';
import Script from 'next/script';
import { notFound, redirect } from 'next/navigation';
import { cookieOpts, safeEq } from '@/lib/auth';
import { db } from '@/lib/db';
import { loadProject, reviewCookie, reviewToken } from '@/lib/review';
import { revisionInfo } from '@/lib/revisions';
import '../review.css';
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

// Password and expired screens use the same card as the sign-in page, spotlight included.
const Gate = ({ tag, children }: { tag: string; children: React.ReactNode }) => (
  <div className="login">
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Urbanist:wght@400;500;600;700&display=swap" />
    <main className="login-wrap">
      <header className="login-top">
        <span className="brand"><span className="brand-mark">R</span><span className="brand-word">Reyal <b>Proof</b></span></span>
        <span className="login-tag">{tag}</span>
      </header>
      <section data-spotlight className="login-card">{children}</section>
      <footer className="login-foot">Reyal Design · Proofs, versions and client feedback in one place.</footer>
    </main>
    <Script src="/spotlight.js" strategy="afterInteractive" />
  </div>
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
  if (access === 'expired')
    return (
      <Gate tag="Design review">
        <h1 className="login-title" style={{ fontSize: 'clamp(34px, 5vw, 52px)' }}>Link expired</h1>
        <p className="login-intro">This review link has expired. Please ask Reyal Design for a new one.</p>
      </Gate>
    );
  if (access === 'locked')
    return (
      <Gate tag="Private proof">
        <h1 className="login-title" style={{ fontSize: 'clamp(34px, 5vw, 52px)' }}>{project.title}</h1>
        <p className="login-intro">This proof is password protected. Enter the password Reyal Design sent you.</p>
        <form action={unlock} className="grid gap-3">
          <input type="hidden" name="slug" value={slug} />
          <input className="input" type="password" name="password" placeholder="Password" autoFocus required />
          {bad && <p className="login-err">Wrong password. Please try again.</p>}
          <button className="btn-login">Open proof</button>
        </form>
      </Gate>
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
      status={project.status}
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
