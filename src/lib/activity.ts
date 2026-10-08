import { db } from './db';

export type ActivityItem = { at: Date; kind: 'proof' | 'version' | 'revision' | 'reply' | 'approved'; text: string; projectId: string; projectTitle: string };

/** A merged, newest-first timeline of what happened across one client's proofs. */
export async function clientActivity(clientId: string, limit = 40): Promise<ActivityItem[]> {
  const projects = await db.project.findMany({
    where: { clientId },
    include: {
      client: true,
      versions: { orderBy: { number: 'asc' } },
      submissions: { include: { _count: { select: { comments: true } } }, orderBy: { number: 'asc' } },
    },
  });
  const replies = await db.comment.findMany({
    where: { fromDesigner: true, version: { project: { clientId } } },
    include: { version: { select: { projectId: true, number: true } } },
  });
  const title = new Map(projects.map((p) => [p.id, p.title]));
  const items: ActivityItem[] = [];
  for (const p of projects) {
    for (const v of p.versions) {
      items.push({ at: v.createdAt, kind: v.number === 1 ? 'proof' : 'version', projectId: p.id, projectTitle: p.title, text: v.number === 1 ? `Proof created: ${v.label}` : `New version uploaded: v${v.number} ${v.label}` });
    }
    const total = p.revisionsIncluded ?? p.client.revisionsIncluded;
    for (const s of p.submissions) {
      items.push({ at: s.createdAt, kind: 'revision', projectId: p.id, projectTitle: p.title, text: `${s.author} sent revision ${s.number}${total ? ` of ${total}` : ''} with ${s._count.comments} comment${s._count.comments === 1 ? '' : 's'} on v${p.versions.find((v) => v.id === s.versionId)?.number ?? '?'}` });
    }
    if (p.approvedAt) items.push({ at: p.approvedAt, kind: 'approved', projectId: p.id, projectTitle: p.title, text: `${p.approvedBy} approved version ${p.approvedVersion}` });
  }
  for (const r of replies) {
    items.push({ at: r.createdAt, kind: 'reply', projectId: r.version.projectId, projectTitle: title.get(r.version.projectId) ?? '', text: `Reyal Design replied on v${r.version.number}: ${r.text.length > 90 ? `${r.text.slice(0, 90)}…` : r.text}` });
  }
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}
