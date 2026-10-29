'use server';

import { revalidatePath } from 'next/cache';
import { requireTool } from '@/lib/access';
import { COST_CATEGORIES } from '@/lib/costsShared';
import { db } from '@/lib/db';

export type CostState = { error?: string; ok?: boolean } | null;
const text = (f: FormData, k: string, max = 300) => String(f.get(k) ?? '').trim().slice(0, max);

export async function saveCost(_: CostState, f: FormData): Promise<CostState> {
  await requireTool('COSTS');
  const name = text(f, 'name');
  if (!name) return { error: 'Enter a name.' };
  const raw = text(f, 'cost');
  const cost = raw === '' ? null : Math.round(Number(raw) * 100) / 100;
  if (cost !== null && (!Number.isFinite(cost) || cost < 0)) return { error: 'The cost must be a number, zero or more.' };
  const renewal = text(f, 'renewal');
  if (renewal && !/^\d{4}-\d{2}-\d{2}$/.test(renewal)) return { error: 'Pick the renewal date from the calendar.' };
  const category = text(f, 'category');
  const data = {
    name, vendor: text(f, 'vendor'), plan: text(f, 'plan'), notes: text(f, 'notes', 1000), renewal, cost,
    category: (COST_CATEGORIES as readonly string[]).includes(category) ? category : 'Other',
    term: Math.min(99, Math.max(1, parseInt(text(f, 'term'), 10) || 1)),
    termUnit: text(f, 'termUnit') === 'mo' ? 'mo' : 'yr',
  };
  const id = text(f, 'id');
  if (id) await db.stackCost.update({ where: { id }, data });
  else await db.stackCost.create({ data });
  revalidatePath('/costs');
  return { ok: true };
}

export async function deleteCost(f: FormData) {
  await requireTool('COSTS');
  await db.stackCost.delete({ where: { id: text(f, 'id') } }).catch(() => {});
  revalidatePath('/costs');
}
