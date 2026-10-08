import { db } from '@/lib/db';
import { notify } from '@/lib/mail';
import { loadProject } from '@/lib/review';
import { revisionInfo } from '@/lib/revisions';

type In = { versionId?: string; name?: string; confirmed?: boolean; comments?: { imageId?: string | null; x?: number | null; y?: number | null; text?: string }[] };
const pct = (n: unknown) => (typeof n === 'number' && n >= 0 && n <= 100 ? n : null);

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { project, access } = await loadProject(slug);
  if (!project || access !== 'ok') return Response.json({ error: 'Not allowed' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as In;
  const version = await db.version.findFirst({ where: { id: body.versionId, projectId: project.id }, include: { images: true } });
  const items = (body.comments ?? []).slice(0, 100).filter((c) => c.text?.trim());
  if (!version || !items.length) return Response.json({ error: 'Nothing to send' }, { status: 400 });
  if (project.approvedVersion === version.number) return Response.json({ error: 'This version has been approved and is closed for revisions.' }, { status: 403 });

  // Each Send Revision uses one revision. The client must have confirmed it, and there must be one left.
  if (body.confirmed !== true) return Response.json({ error: 'Please confirm this revision before sending.' }, { status: 400 });
  const rev = await revisionInfo(project.id);
  if (rev.left <= 0) return Response.json({ error: `All ${rev.included} included revisions have been used. Please contact Reyal Design to arrange more.` }, { status: 403 });

  const author = (body.name ?? '').trim().slice(0, 80) || 'Guest';
  let pin = (await db.comment.aggregate({ where: { versionId: version.id }, _max: { pin: true } }))._max.pin ?? 0;
  const rows = items.map((c) => {
    const x = pct(c.x), y = pct(c.y);
    const located = x != null && y != null;
    return {
      versionId: version.id,
      imageId: located ? version.images.find((i) => i.id === c.imageId)?.id ?? null : null,
      author,
      text: c.text!.trim().slice(0, 4000),
      x: located ? x : null,
      y: located ? y : null,
      pin: located ? ++pin : null,
    };
  });
  const number = rev.used + 1;
  await db.$transaction(async (tx) => {
    const sub = await tx.submission.create({ data: { projectId: project.id, versionId: version.id, number, author } });
    await tx.comment.createMany({ data: rows.map((r) => ({ ...r, submissionId: sub.id })) });
    await tx.project.update({ where: { id: project.id }, data: { status: 'Feedback Received' } });
  });

  const base = process.env.APP_URL || '';
  const ordered = [...version.images].sort((a, b) => a.position - b.position);
  const pageOf = (id: string | null) => ordered.findIndex((i) => i.id === id) + 1;
  await notify(
    `${author} sent revision ${number} of ${rev.included} (${rows.length} comment${rows.length === 1 ? '' : 's'}) on ${project.client.name} / ${project.title}`,
    `${rows.map((r) => `${r.pin ? `#${r.pin} (page ${pageOf(r.imageId)}, ${r.x!.toFixed(0)}% from left, ${r.y!.toFixed(0)}% from top)` : 'General'}: ${r.text}`).join('\n')}\n\nSee each change marked on the design: ${base}/admin/${project.id}`,
  );
  return Response.json({ ok: true, count: rows.length });
}
