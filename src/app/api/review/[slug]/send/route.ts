import { db } from '@/lib/db';
import { mirrorToFigma } from '@/lib/figmaSync';
import { isDevice, pathOf, sameSite } from '@/lib/live';
import { notify } from '@/lib/mail';
import { loadProject } from '@/lib/review';
import { revisionInfo } from '@/lib/revisions';

type In = {
  versionId?: string; name?: string; confirmed?: boolean;
  comments?: {
    imageId?: string | null; x?: number | null; y?: number | null; text?: string;
    // live website comments
    pageUrl?: string; selector?: string; elementText?: string; rx?: number | null; ry?: number | null; vw?: number | null; device?: string; shot?: string | null;
  }[];
};
const pct = (n: unknown) => (typeof n === 'number' && n >= 0 && n <= 100 ? n : null);
const px = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 200_000 ? n : null);
const ratio = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n >= -0.5 && n <= 1.5 ? n : null);
const NO_LIVE = { pageUrl: null, selector: null, elementText: null, rx: null, ry: null, vw: null, device: null, shot: null };

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
  const live = !!version.liveUrl;
  const rows = items.map((c) => {
    if (live) {
      // A live website comment is located by its page and element, or by page pixels. A screenshot must be one this review page uploaded.
      const x = px(c.x), y = px(c.y);
      // The page must be on the proof's own site. Its address is opened later in the admin's frame, so nothing else is accepted.
      const page = c.pageUrl && sameSite(c.pageUrl, version.liveUrl) ? c.pageUrl : null;
      const located = !!page && (!!c.selector || (x != null && y != null));
      const vw = px(c.vw);
      return {
        versionId: version.id, imageId: null, author, text: c.text!.trim().slice(0, 4000),
        x: located ? x : null, y: located ? y : null, pin: located ? ++pin : null,
        pageUrl: located ? page!.slice(0, 1000) : null,
        selector: located && c.selector ? c.selector.slice(0, 500) : null,
        elementText: located && c.elementText ? c.elementText.slice(0, 300) : null,
        rx: located ? ratio(c.rx) : null, ry: located ? ratio(c.ry) : null,
        vw: located && vw != null ? Math.round(vw) : null,
        device: located && isDevice(c.device) ? c.device : null,
        shot: located && typeof c.shot === 'string' && /^shot-[\w-]+\.jpg$/.test(c.shot) ? c.shot : null,
      };
    }
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
      ...NO_LIVE,
    };
  });
  const number = rev.used + 1;
  let submissionId = '';
  await db.$transaction(async (tx) => {
    const sub = await tx.submission.create({ data: { projectId: project.id, versionId: version.id, number, author } });
    submissionId = sub.id;
    await tx.comment.createMany({ data: rows.map((r) => ({ ...r, submissionId: sub.id })) });
    await tx.project.update({ where: { id: project.id }, data: { status: 'Feedback Received' } });
  });

  if (version.figma) void mirrorToFigma(version.id, submissionId, number, author); // posted into the Figma file in the background
  const base = process.env.APP_URL || '';
  const ordered = [...version.images].sort((a, b) => a.position - b.position);
  const pageOf = (id: string | null) => ordered.findIndex((i) => i.id === id) + 1;
  const where = (r: (typeof rows)[number]) => {
    if (!r.pin) return 'General';
    if (r.pageUrl) return `#${r.pin} (${pathOf(r.pageUrl)}${r.device ? `, ${r.device}` : ''}${r.elementText ? `, "${r.elementText.slice(0, 60)}"` : ''})`;
    return `#${r.pin} (page ${pageOf(r.imageId)}, ${r.x!.toFixed(0)}% from left, ${r.y!.toFixed(0)}% from top)`;
  };
  await notify(
    `${author} sent revision ${number} of ${rev.included} (${rows.length} comment${rows.length === 1 ? '' : 's'}) on ${project.client.name} / ${project.title}`,
    `${rows.map((r) => `${where(r)}: ${r.text}`).join('\n')}\n\nSee each change marked on the ${live ? 'site' : 'design'}: ${base}/admin/${project.id}`,
  );
  return Response.json({ ok: true, count: rows.length });
}
