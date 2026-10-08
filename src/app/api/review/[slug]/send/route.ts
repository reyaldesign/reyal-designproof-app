import { db } from '@/lib/db';
import { notify } from '@/lib/mail';
import { loadProject } from '@/lib/review';

type In = { versionId?: string; name?: string; comments?: { imageId?: string | null; x?: number | null; y?: number | null; text?: string }[] };
const pct = (n: unknown) => (typeof n === 'number' && n >= 0 && n <= 100 ? n : null);

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { project, access } = await loadProject(slug);
  if (!project || access !== 'ok') return Response.json({ error: 'Not allowed' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as In;
  const version = await db.version.findFirst({ where: { id: body.versionId, projectId: project.id }, include: { images: true } });
  const items = (body.comments ?? []).slice(0, 100).filter((c) => c.text?.trim());
  if (!version || !items.length) return Response.json({ error: 'Nothing to send' }, { status: 400 });

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
  await db.$transaction([
    db.comment.createMany({ data: rows }),
    db.project.update({ where: { id: project.id }, data: { status: 'Feedback Received' } }),
  ]);

  const base = process.env.APP_URL || '';
  await notify(
    `${author} sent ${rows.length} comment${rows.length === 1 ? '' : 's'} on ${project.title}`,
    `${rows.map((r) => `${r.pin ? `#${r.pin}` : 'General'}: ${r.text}`).join('\n')}\n\n${base}/admin`,
  );
  return Response.json({ ok: true, count: rows.length });
}
