import { notFound } from 'next/navigation';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import { refuseTool, requireTool, type Tool } from './access';

// ----- feature switch: the whole tool is hidden unless AI_REVIEWER_ENABLED=true -----
export const aiEnabled = () => process.env.AI_REVIEWER_ENABLED === 'true';

/** For pages and server actions: the person has the given AI tool, and the tool is switched on (otherwise this whole section is a 404). */
export async function requireAi(tool: Tool = 'AI_REVIEW') {
  if (!aiEnabled()) notFound();
  await requireTool(tool);
}
/** For API routes: returns a Response to send back when the request must be refused, otherwise null. */
export async function refuseAi(tool: Tool = 'AI_REVIEW'): Promise<Response | null> {
  if (!aiEnabled()) return Response.json({ error: 'Not found' }, { status: 404 });
  return refuseTool(tool);
}

export * from './aiShared';
import { verdictFor } from './aiShared';
import type { Check, ReviewResult } from './aiShared';

// ----- limits -----
const MODEL = () => process.env.AI_REVIEWER_MODEL || 'claude-sonnet-5';
const EFFORT = () => (process.env.AI_REVIEWER_EFFORT || 'high') as 'low' | 'medium' | 'high' | 'xhigh' | 'max';
const MAX_TOKENS = () => Number(process.env.AI_REVIEWER_MAX_TOKENS || 8192);
const PRICE_IN = () => Number(process.env.PRICE_PER_MTOK_INPUT || 2.0);
const PRICE_OUT = () => Number(process.env.PRICE_PER_MTOK_OUTPUT || 10.0);
export const estimateCostUsd = (inTok: number, outTok: number) => (inTok / 1e6) * PRICE_IN() + (outTok / 1e6) * PRICE_OUT();
export const aiKeyConfigured = () => !!process.env.ANTHROPIC_API_KEY?.trim();
export const aiModel = MODEL;

// Ported unchanged from the original tool so results stay comparable.
export const SYSTEM_PROMPT =
  'You are a meticulous image review assistant. You are given an image and a checklist of review criteria.\n\n' +
  'Work through this carefully before writing your final answer:\n' +
  '1. First, describe briefly what you actually see in the image. If any criterion relates to text, spelling, wording, or labels, ' +
  'transcribe the exact text visible in the image as precisely as you can before judging it — do not assume or guess what the text says.\n' +
  '2. For EACH criterion, give a status based only on what you directly observed in step 1: "pass" (clearly met), "warn" (met, but with a ' +
  'minor weakness a designer should look at, such as small or low-contrast text), or "fail" (not met). Add a one-sentence comment explaining ' +
  'why. If a detail is unclear or ambiguous, look again rather than assuming it is correct.\n' +
  '3. For each criterion that is "warn" or "fail", also estimate WHERE in the image the problem is visually located, if it corresponds to a ' +
  'specific spot (such as a misspelled word, a particular object, or a specific area) rather than a property of the whole image (such as ' +
  'overall blur or resolution). Give this as a "location" field: {"x": <0.0-1.0>, "y": <0.0-1.0>} marking the approximate center of the ' +
  'issue, where x=0 is the left edge of the image, x=1 is the right edge, y=0 is the top, and y=1 is the bottom. This is a best-effort ' +
  'visual estimate, not a precise measurement — do your best but it is OK to be approximate. If the issue does not correspond to a ' +
  'specific location, omit the "location" field entirely for that check.\n' +
  '4. Compute an overall score from 0-100: each pass counts fully, each warn counts half, each fail counts zero, averaged over all ' +
  'criteria. The verdict is derived from your score afterwards, so do not include one.\n\n' +
  'Keep your reasoning concise — a few sentences of observation is enough, you do not need to write a long essay before answering.\n\n' +
  'Also include a "summary" field: 1-3 sentences in plain language explaining WHY you reached this score, referencing the specific ' +
  'criteria that drove the decision.\n\n' +
  'Also include an "action_items" field: a list of short, concrete strings describing exactly what needs to be fixed for this image to ' +
  'pass review. Base this only on criteria that are warn or fail. Use an empty list if every criterion passes.\n\n' +
  'Respond with ONLY valid JSON, no markdown code fences, no extra commentary, in exactly this shape (the "location" field is optional ' +
  'per check and should be omitted, not null, when there isn\'t one):\n' +
  '{"score": <int 0-100>, "summary": "<string>", "action_items": ["<string>", ...], ' +
  '"checks": [{"criterion": "<string>", "status": "pass|warn|fail", "comment": "<string>", "location": {"x": <0.0-1.0>, "y": <0.0-1.0>}}]}';

export function extractJson(raw: string): unknown {
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^`+/, '').replace(/`+$/, '');
    const nl = text.indexOf('\n');
    if (nl >= 0) text = text.slice(nl + 1);
  }
  return JSON.parse(text);
}

/** Validates the model's checks so bad data (wrong types, out-of-range locations) never reaches the screen. */
export function sanitizeChecks(checks: unknown): Check[] {
  if (!Array.isArray(checks)) return [];
  const out: Check[] = [];
  for (const c of checks) {
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    const status = o.status === 'pass' || o.status === 'warn' || o.status === 'fail' ? o.status : o.pass ? 'pass' : 'fail';
    const entry: Check = { criterion: String(o.criterion ?? ''), status, comment: String(o.comment ?? '') };
    const loc = o.location as Record<string, unknown> | undefined;
    if (loc && typeof loc === 'object') {
      const x = Number(loc.x), y = Number(loc.y);
      if (Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1) entry.location = { x, y };
    }
    out.push(entry);
  }
  return out;
}

/** Re-encodes the image for Claude: honours phone rotation and stays well under the API's per-image size limit. */
export async function prepareForClaude(buf: Buffer) {
  const pipeline = () => sharp(buf, { limitInputPixels: 200_000_000 }).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' });
  for (const quality of [88, 78, 68]) {
    const out = await pipeline().jpeg({ quality }).toBuffer();
    if (out.length <= 4.5 * 1024 * 1024) return out;
  }
  return pipeline().resize({ width: 1400, height: 1400, fit: 'inside' }).jpeg({ quality: 70 }).toBuffer();
}

export class AiFailure extends Error {}

/** One review. Throws AiFailure with a plain-language message when nothing could be judged (so nothing is saved or billed twice). */
export async function reviewWithClaude(image: Buffer, criteria: string[]): Promise<{ result: ReviewResult; inputTokens: number; outputTokens: number }> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new AiFailure('ANTHROPIC_API_KEY is not set on the server. Add it to .env and restart.');
  const anthropic = new Anthropic({ apiKey: key });
  const list = criteria.map((c) => `- ${c}`).join('\n') || '- General image quality';

  let message: Anthropic.Message;
  try {
    message = await anthropic.messages.create({
      model: MODEL(),
      max_tokens: MAX_TOKENS(),
      system: SYSTEM_PROMPT,
      // `temperature` is intentionally omitted: current models reject it. `effort` is the consistency lever.
      output_config: { effort: EFFORT() },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image.toString('base64') } },
          { type: 'text', text: `Review criteria:\n${list}` },
        ],
      }],
    });
  } catch (e) {
    if (e instanceof Anthropic.APIError) throw new AiFailure(`Claude API error (${e.status ?? 'network'}): ${e.message}`);
    throw new AiFailure(`Unexpected error calling Claude: ${e instanceof Error ? e.message : String(e)}`);
  }
  const inputTokens = message.usage?.input_tokens ?? 0;
  const outputTokens = message.usage?.output_tokens ?? 0;
  if (message.stop_reason === 'max_tokens') {
    throw new AiFailure(`Claude's response was cut off before finishing (hit the ${MAX_TOKENS()}-token limit at effort "${EFFORT()}"). Raise AI_REVIEWER_MAX_TOKENS or lower AI_REVIEWER_EFFORT.`);
  }
  try {
    const raw = message.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    const j = extractJson(raw) as Record<string, unknown>;
    const score = Math.max(0, Math.min(100, Math.round(Number(j.score) || 0)));
    return {
      result: {
        score,
        verdict: verdictFor(score),
        summary: String(j.summary ?? ''),
        actionItems: Array.isArray(j.action_items) ? j.action_items.map(String) : [],
        checks: sanitizeChecks(j.checks),
      },
      inputTokens,
      outputTokens,
    };
  } catch {
    throw new AiFailure('The AI response could not be parsed as JSON. Try reviewing again.');
  }
}

// A small queue so a big batch cannot flood the API (and your bill): at most N reviews run at once.
let running = 0;
const waiting: (() => void)[] = [];
export async function withSlot<T>(fn: () => Promise<T>, limit = Number(process.env.AI_MAX_CONCURRENT || 3)): Promise<T> {
  if (running >= limit) await new Promise<void>((r) => waiting.push(r));
  running++;
  try { return await fn(); } finally { running--; waiting.shift()?.(); }
}
