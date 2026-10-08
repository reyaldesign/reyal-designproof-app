import { db } from '@/lib/db';
import { notify } from '@/lib/mail';
import { loadProject } from '@/lib/review';

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { project, access } = await loadProject(slug);
  if (!project || access !== 'ok') return Response.json({ error: 'Not allowed' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { name?: string; agreed?: boolean; versionNumber?: number };
  const name = (body.name ?? '').trim().slice(0, 80);
  if (name.length < 2) return Response.json({ error: 'Please enter your name.' }, { status: 400 });
  if (body.agreed !== true) return Response.json({ error: 'Please accept the terms to approve.' }, { status: 400 });
  if (project.approvedVersion != null) return Response.json({ error: 'This proof is already approved.' }, { status: 409 });
  if (body.versionNumber !== project.versions[0].number) return Response.json({ error: 'A newer version exists. Please review the latest version.' }, { status: 409 });

  await db.project.update({
    where: { id: project.id },
    data: { status: 'Approved', approvedAt: new Date(), approvedBy: name, approvedVersion: body.versionNumber },
  });
  await notify(
    `${project.client.name} / ${project.title} approved`,
    `${name} approved version ${body.versionNumber} (${project.versions[0].label}) and accepted the terms. No further revisions can be applied to it.\n\n${process.env.APP_URL || ''}/admin/${project.id}`,
  );
  return Response.json({ ok: true });
}
