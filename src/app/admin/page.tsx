import { db } from '@/lib/db';
import { statusDot, thumb, timeAgo } from '@/lib/format';
import ClientGrid, { type ClientCard } from './ClientGrid';

export const dynamic = 'force-dynamic';

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const [clients, open] = await Promise.all([
    db.client.findMany({
      orderBy: { name: 'asc' },
      include: {
        projects: {
          orderBy: { createdAt: 'desc' },
          include: { versions: { orderBy: { number: 'desc' }, take: 1, include: { images: { orderBy: { position: 'asc' }, take: 1 } } } },
        },
      },
    }),
    db.comment.findMany({
      where: { parentId: null, resolved: false, fromDesigner: false },
      select: { createdAt: true, version: { select: { project: { select: { clientId: true } } } } },
    }),
  ]);

  const cards: ClientCard[] = clients.map((c) => {
    const mine = open.filter((o) => o.version.project.clientId === c.id);
    const last = [c.createdAt, ...c.projects.map((p) => p.createdAt), ...mine.map((m) => m.createdAt)].reduce((a, b) => (b > a ? b : a));
    const first = c.projects[0]?.versions[0]?.images[0]?.file;
    return {
      id: c.id,
      name: c.name,
      thumb: first ? thumb(first) : null,
      open: mine.length,
      dots: c.projects.slice(0, 5).map((p) => ({ ...statusDot(p.status), title: `${p.title}: ${p.status}` })),
      ago: timeAgo(last),
    };
  });

  return <ClientGrid clients={cards} error={error} />;
}
