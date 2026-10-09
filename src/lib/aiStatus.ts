import Anthropic from '@anthropic-ai/sdk';
import { aiKeyConfigured } from './ai';

export type AiState = 'active' | 'degraded' | 'down';
export type AiStatus = {
  state: AiState;
  reason: string;
  checkedAt: string;
  lastReview: { ok: boolean; at: string; message?: string } | null;
};

// ----- what happened to the most recent real review (kept in memory, resets on restart) -----
let last: { ok: boolean; at: number; message?: string } | null = null;
export function recordReviewOutcome(ok: boolean, message?: string) {
  last = { ok, at: Date.now(), message };
  cached = null; // the next status request should look again
}

// ----- the live check, cached briefly so a page full of tabs cannot hammer the API -----
const TTL_MS = 45_000;
const MIN_GAP_MS = 3_000;
let cached: { at: number; value: AiStatus } | null = null;
let inflight: Promise<AiStatus> | null = null;

async function probe(): Promise<{ state: AiState; reason: string }> {
  if (!aiKeyConfigured()) return { state: 'down', reason: 'No Anthropic API key is set on the server.' };
  // Listing models costs nothing (no tokens), so this can run all day without adding to the bill.
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!.trim(), maxRetries: 0, timeout: 8000 });
  try {
    await anthropic.models.list({ limit: 1 });
    return { state: 'active', reason: 'Connected to Anthropic.' };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { state: 'down', reason: 'Anthropic rejected the API key. Check the key in .env.' };
    if (e instanceof Anthropic.PermissionDeniedError) return { state: 'down', reason: 'This API key is not allowed to use the API.' };
    if (e instanceof Anthropic.RateLimitError) return { state: 'degraded', reason: 'Anthropic is rate limiting requests. Reviews may be slow.' };
    if (e instanceof Anthropic.InternalServerError) return { state: 'down', reason: 'Anthropic is having problems right now.' };
    if (e instanceof Anthropic.APIConnectionError) return { state: 'down', reason: 'The server cannot reach Anthropic.' };
    if (e instanceof Anthropic.APIError) return { state: 'degraded', reason: `Anthropic answered with an error (${e.status}).` };
    return { state: 'down', reason: 'The check could not complete.' };
  }
}

export async function checkAiStatus(fresh = false): Promise<AiStatus> {
  const now = Date.now();
  if (cached && now - cached.at < (fresh ? MIN_GAP_MS : TTL_MS)) return cached.value;
  inflight ??= (async () => {
    const p = await probe();
    let { state, reason } = p;
    // A reachable API can still be failing real work (for example out of credits). Say so while that is the latest news.
    if (state === 'active' && last && !last.ok && Date.now() - last.at < 15 * 60_000) {
      const credit = /credit balance|billing/i.test(last.message ?? '');
      state = credit ? 'down' : 'degraded';
      reason = credit ? 'Out of API credits. Add credits in the Anthropic console.' : `The last review failed: ${(last.message ?? '').slice(0, 140)}`;
    }
    const value: AiStatus = {
      state, reason, checkedAt: new Date().toISOString(),
      lastReview: last ? { ok: last.ok, at: new Date(last.at).toISOString(), message: last.message } : null,
    };
    cached = { at: Date.now(), value };
    return value;
  })().finally(() => { inflight = null; });
  return inflight;
}
