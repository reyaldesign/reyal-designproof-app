import { requireAi } from '@/lib/ai';
import { db } from '@/lib/db';
import type { Check, Verdict } from '@/lib/ai';
import HistoryList, { type HistoryRow } from './HistoryList';

function parse<T>(s: string, fallback: T): T {
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

export default async function HistoryPage() {
  await requireAi('AI_REVIEW');
  const rows = await db.aiReview.findMany({ orderBy: { createdAt: 'desc' }, take: 500, include: { client: { select: { logoFile: true } } } });
  const data: HistoryRow[] = rows.map((r) => ({
    id: r.id, imageFile: r.imageFile, filename: r.originalFilename, score: r.score, verdict: r.verdict as Verdict, summary: r.summary,
    actionItems: parse<string[]>(r.actionItems, []), checks: parse<Check[]>(r.checks, []),
    clientName: r.clientName, clientLogo: r.client?.logoFile ?? null, categoryName: r.categoryName, createdAt: r.createdAt.toISOString(),
  }));
  return <HistoryList rows={data} />;
}
