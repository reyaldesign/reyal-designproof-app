import Anthropic from '@anthropic-ai/sdk';
import { AiFailure, extractJson } from './ai';
import type { Check } from './aiShared';

/** What gets translated for one review: the words, never the score, the verdict or the marker positions. */
export type ReviewText = { summary: string; actionItems: string[]; checks: { criterion: string; comment: string }[] };
export const textOf = (r: { summary: string; actionItems: string[]; checks: Check[] }): ReviewText => ({
  summary: r.summary, actionItems: r.actionItems, checks: r.checks.map((c) => ({ criterion: c.criterion, comment: c.comment })),
});

const MODEL = () => process.env.AI_TRANSLATE_MODEL || 'claude-haiku-5-5';
const SYSTEM =
  'You translate image review results from English into neutral US Spanish for a design team. ' +
  'Keep every number, file name, brand name, color code and quoted text exactly as it is. Keep the same plain, professional tone and the same meaning, adding nothing. ' +
  'Return ONLY JSON of exactly this shape, with the same number of items in the same order: ' +
  '{"summary": "<string>", "action_items": ["<string>"], "checks": [{"criterion": "<string>", "comment": "<string>"}]}';

/** English to Spanish with a small, cheap model. Throws AiFailure when it cannot return a clean, same-shape result. */
export async function translateToSpanish(src: ReviewText): Promise<{ text: ReviewText; inputTokens: number; outputTokens: number }> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new AiFailure('ANTHROPIC_API_KEY is not set on the server. Add it to .env and restart.');
  const anthropic = new Anthropic({ apiKey: key, maxRetries: 1, timeout: 60_000 });
  let message: Anthropic.Message;
  try {
    message = await anthropic.messages.create({
      model: MODEL(),
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify({ summary: src.summary, action_items: src.actionItems, checks: src.checks }) }],
    });
  } catch (e) {
    throw new AiFailure(e instanceof Anthropic.APIError ? `Claude API error (${e.status ?? 'network'}): ${e.message}` : 'The translation could not be made.');
  }
  if (message.stop_reason === 'max_tokens') throw new AiFailure('The translation was cut off.');
  try {
    const j = extractJson(message.content.map((b) => (b.type === 'text' ? b.text : '')).join('')) as Record<string, unknown>;
    const items = Array.isArray(j.action_items) ? j.action_items.map(String) : [];
    const checks = Array.isArray(j.checks) ? (j.checks as Record<string, unknown>[]).map((c) => ({ criterion: String(c?.criterion ?? ''), comment: String(c?.comment ?? '') })) : [];
    if (items.length !== src.actionItems.length || checks.length !== src.checks.length) throw new Error('shape');
    return { text: { summary: String(j.summary ?? ''), actionItems: items, checks }, inputTokens: message.usage?.input_tokens ?? 0, outputTokens: message.usage?.output_tokens ?? 0 };
  } catch {
    throw new AiFailure('The translation could not be read.');
  }
}
