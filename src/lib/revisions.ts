import { db } from './db';

/** How many revision rounds a proof includes, and how many the client has used (each "Send now" is one). */
export async function revisionInfo(projectId: string) {
  const p = await db.project.findUniqueOrThrow({ where: { id: projectId }, include: { client: true, _count: { select: { submissions: true } } } });
  const included = p.revisionsIncluded ?? p.client.revisionsIncluded;
  const used = p._count.submissions;
  return { included, used, left: Math.max(0, included - used) };
}
