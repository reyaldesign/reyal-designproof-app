import { requireTool } from '@/lib/access';
import { db } from '@/lib/db';
import { thumb, timeAgo } from '@/lib/format';
import { STATUS_ORDER } from '@/lib/status';
import { aiEnabled } from '@/lib/ai';
import ClientGrid, { type AttentionItem, type ClientCard } from './ClientGrid';

export const dynamic = 'force-dynamic';

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requireTool('PROOFS');
  const { error } = await searchParams;
  const [clients, openComments] = await Promise.all([
    db.client.findMany({
      orderBy: { name: 'asc' },
      include: {
        projects: {
          orderBy: { createdAt: 'desc' },
          include: {
            submissions: { select: { createdAt: true } },
            versions: { orderBy: { number: 'desc' }, take: 1, include: { images: { orderBy: { position: 'asc' }, take: 1 } } },
          },
        },
      },
    }),
    db.comment.findMany({
      where: { parentId: null, resolved: false, fromDesigner: false },
      select: { createdAt: true, version: { select: { projectId: true } } },
    }),
  ]);

  const openByProject = new Map<string, { n: number; at: Date }>();
  for (const o of openComments) {
    const cur = openByProject.get(o.version.projectId);
    openByProject.set(o.version.projectId, { n: (cur?.n ?? 0) + 1, at: cur && cur.at > o.createdAt ? cur.at : o.createdAt });
  }

  const cards: ClientCard[] = clients.map((c) => {
    const times = [c.createdAt, ...c.projects.flatMap((p) => [p.createdAt, ...p.submissions.map((s) => s.createdAt)])];
    const last = times.reduce((a, b) => (b > a ? b : a));
    const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, c.projects.filter((p) => p.status === s).length])) as Record<string, number>;
    const first = c.projects[0]?.versions[0]?.images[0]?.file;
    return {
      id: c.id,
      name: c.name,
      thumb: first ? thumb(first) : null,
      open: c.projects.reduce((n, p) => n + (openByProject.get(p.id)?.n ?? 0), 0),
      counts,
      total: c.projects.length,
      lastMs: last.getTime(),
      ago: timeAgo(last),
      latestTitle: c.projects[0]?.title ?? null,
      types: [...new Set(c.projects.map((p) => p.type).filter((t): t is string => !!t))],
      titles: c.projects.map((p) => p.title),
    };
  });

  // The proofs with the most recent open comments, for the "Waiting on you" strip.
  const attention: AttentionItem[] = clients
    .flatMap((c) => c.projects.map((p) => ({ c, p, o: openByProject.get(p.id) })))
    .filter((x) => x.o)
    .sort((a, b) => b.o!.at.getTime() - a.o!.at.getTime())
    .map(({ c, p, o }) => ({
      proofId: p.id,
      title: p.title,
      client: c.name,
      version: p.versions[0]?.number ?? 1,
      ago: timeAgo(o!.at),
      open: o!.n,
      thumb: p.versions[0]?.images[0]?.file ? thumb(p.versions[0].images[0].file, 320) : null,
    }));

  return <ClientGrid clients={cards} attention={attention} totalOpen={openComments.length} error={error} aiTool={aiEnabled() && me.tools.includes('AI_REVIEW')} />;
}
