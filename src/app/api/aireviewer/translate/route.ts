import { AiFailure, refuseAi, withSlot } from '@/lib/ai';
import { textOf, translateToSpanish, type ReviewText } from '@/lib/aiTranslate';
import { db } from '@/lib/db';

const parse = <T>(s: string, fallback: T): T => { try { return JSON.parse(s) as T; } catch { return fallback; } };

/** The Spanish version of one review. Made the first time it is asked for, then kept with the review. */
export async function POST(req: Request) {
  const refused = await refuseAi('AI_REVIEW');
  if (refused) return refused;
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  const review = typeof id === 'string' ? await db.aiReview.findUnique({ where: { id } }) : null;
  if (!review) return Response.json({ error: 'Not found' }, { status: 404 });

  const saved = parse<{ es?: ReviewText }>(review.translations, {});
  if (saved.es) return Response.json({ es: saved.es });

  try {
    const src = textOf({ summary: review.summary, actionItems: parse<string[]>(review.actionItems, []), checks: parse(review.checks, []) });
    const { text } = await withSlot(() => translateToSpanish(src));
    await db.aiReview.update({ where: { id: review.id }, data: { translations: JSON.stringify({ ...saved, es: text }) } });
    return Response.json({ es: text });
  } catch (e) {
    if (!(e instanceof AiFailure)) console.error('translation failed', e);
    return Response.json({ error: 'The translation is not available right now.' }, { status: 502 });
  }
}
