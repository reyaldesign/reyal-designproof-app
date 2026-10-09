import { db } from './db';
import type { AiClientLite } from '@/app/aireviewer/types';

/** The tool's clients with their categories and criteria, in display order. */
export async function loadAiClients(): Promise<AiClientLite[]> {
  const rows = await db.aiClient.findMany({
    orderBy: { name: 'asc' },
    include: {
      criteria: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
      categories: { orderBy: [{ position: 'asc' }, { id: 'asc' }], include: { criteria: { orderBy: [{ position: 'asc' }, { id: 'asc' }] } } },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    notes: c.notes,
    base: c.criteria.filter((x) => x.categoryId === null).map((x) => ({ id: x.id, text: x.text })),
    categories: c.categories.map((cat) => ({ id: cat.id, name: cat.name, criteria: cat.criteria.map((x) => ({ id: x.id, text: x.text })) })),
  }));
}
