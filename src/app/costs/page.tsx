import { db } from '@/lib/db';
import type { CostRow } from '@/lib/costsShared';
import CostsApp from './CostsApp';

export default async function CostsPage() {
  const rows: CostRow[] = (await db.stackCost.findMany({ orderBy: { name: 'asc' } })).map((r) => ({
    id: r.id, name: r.name, vendor: r.vendor, category: r.category, cost: r.cost,
    term: r.term, termUnit: r.termUnit, renewal: r.renewal, plan: r.plan, notes: r.notes,
  }));
  return <CostsApp rows={rows} />;
}
