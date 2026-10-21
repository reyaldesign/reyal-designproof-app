import { db } from './db';
import type { AiClientLite } from '@/app/aireviewer/types';
import { GENERAL, generalKind, isKind, type Kind } from './aiShared';

const asKind = (v: string): Kind => (isKind(v) ? v : 'social');

/** The tool's clients with their categories and criteria, in display order. */
export async function loadAiClients(): Promise<AiClientLite[]> {
  const shared = Object.values(GENERAL).map((g) => g!); // the two shared lists exist from first use
  if (await db.aiClient.count({ where: { id: { in: shared.map((g) => g.id) } } }) < shared.length) {
    for (const g of shared) await db.aiClient.upsert({ where: { id: g.id }, create: { id: g.id, name: g.name }, update: {} });
  }
  const rows = await db.aiClient.findMany({
    orderBy: { name: 'asc' },
    include: {
      criteria: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
      categories: { orderBy: [{ position: 'asc' }, { id: 'asc' }], include: { criteria: { orderBy: [{ position: 'asc' }, { id: 'asc' }] } } },
    },
  });
  return rows.map((c) => ({
    general: generalKind(c.id),
    id: c.id,
    name: c.name,
    notes: c.notes,
    logo: c.logoFile,
    base: c.criteria.filter((x) => x.categoryId === null).map((x) => ({ id: x.id, text: x.text, kind: asKind(x.kind) })),
    categories: c.categories.map((cat) => ({ id: cat.id, name: cat.name, kind: asKind(cat.kind), criteria: cat.criteria.map((x) => ({ id: x.id, text: x.text })) })),
  }));
}
