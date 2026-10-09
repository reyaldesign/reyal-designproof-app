import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { requireTool } from '@/lib/access';
import { db } from '@/lib/db';
import { revisionInfo } from '@/lib/revisions';
import './proof.css';
import ProofWorkspace from './ProofWorkspace';

export const dynamic = 'force-dynamic';

export default async function ProofPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireTool('PROOFS');
  const { id } = await params;
  const { error } = await searchParams;
  const p = await db.project.findUnique({
    where: { id },
    include: {
      client: true,
      versions: {
        orderBy: { number: 'desc' },
        include: { images: { orderBy: { position: 'asc' } }, comments: { orderBy: { createdAt: 'asc' } } },
      },
    },
  });
  if (!p) notFound();
  const h = await headers();
  const base = process.env.APP_URL || `${h.get('x-forwarded-proto') || 'http'}://${h.get('host')}`;
  const rev = await revisionInfo(p.id);

  return (
    <ProofWorkspace
      proof={{
        id: p.id, slug: p.slug, title: p.title, type: p.type, status: p.status, password: p.password,
        expires: p.expiresAt ? p.expiresAt.toISOString().slice(0, 10) : null,
        revisionsIncluded: p.revisionsIncluded, approvedBy: p.approvedBy,
        approvedAt: p.approvedAt ? p.approvedAt.toISOString() : null, approvedVersion: p.approvedVersion,
      }}
      client={{ id: p.client.id, name: p.client.name, email: p.client.email, revisionsIncluded: p.client.revisionsIncluded }}
      revisions={{ used: rev.used, included: rev.included }}
      versions={p.versions.map((v) => ({
        id: v.id, number: v.number, label: v.label, createdAt: v.createdAt.toISOString(),
        images: v.images.map((i) => ({ id: i.id, file: i.file })),
        comments: v.comments.map((c) => ({
          id: c.id, imageId: c.imageId, parentId: c.parentId, author: c.author, text: c.text, x: c.x, y: c.y, pin: c.pin,
          resolved: c.resolved, fromDesigner: c.fromDesigner, createdAt: c.createdAt.toISOString(),
        })),
      }))}
      link={`${base}/review/${p.slug}`}
      error={error}
    />
  );
}
