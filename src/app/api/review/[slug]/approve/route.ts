import { db } from '@/lib/db';
import { notify } from '@/lib/mail';
import { loadProject } from '@/lib/review';

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { project, access } = await loadProject(slug);
  if (!project || access !== 'ok') return Response.json({ error: 'Not allowed' }, { status: 403 });
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  await db.project.update({ where: { id: project.id }, data: { status: 'Approved' } });
  await notify(`${project.title} approved`, `${(name ?? '').trim().slice(0, 80) || 'The client'} approved the latest version.`);
  return Response.json({ ok: true });
}
