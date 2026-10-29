// Browser-safe helpers for the Stack costs page.
export const COST_CATEGORIES = ['Plugin', 'Hosting', 'Domain', 'Backup', 'SEO', 'Software', 'Other'] as const;

export type CostRow = {
  id: string; name: string; vendor: string; category: string; cost: number | null;
  term: number; termUnit: string; renewal: string; plan: string; notes: string;
};

/** Length of one billing term in months. */
export const termMonths = (r: Pick<CostRow, 'term' | 'termUnit'>) => Math.max(1, r.term) * (r.termUnit === 'mo' ? 1 : 12);
/** What the item costs per month, or null when no price is set. */
export const perMonth = (r: CostRow) => (r.cost == null ? null : r.cost / termMonths(r));
export const termLabel = (r: Pick<CostRow, 'term' | 'termUnit'>) => {
  const m = termMonths(r);
  return m === 1 ? 'Month' : m === 12 ? 'Year' : m % 12 ? `${m} months` : `${m / 12} years`;
};
export const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/** Whole days from today to a YYYY-MM-DD date (negative when it has passed), or null when there is no date. */
export function daysTo(d: string) {
  if (!d) return null;
  const t = new Date(`${d}T00:00:00`), n = new Date();
  n.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - n.getTime()) / 864e5);
}
export const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
