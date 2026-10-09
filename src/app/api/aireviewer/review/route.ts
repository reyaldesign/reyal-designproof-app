import { AI_IMAGE_TYPES, AI_MAX_IMAGE_MB, AiFailure, refuseAi, reviewWithClaude, prepareForClaude, withSlot } from '@/lib/ai';
import { saveAiImage } from '@/lib/aiStorage';
import { recordReviewOutcome } from '@/lib/aiStatus';
import { db } from '@/lib/db';

/** Reviews one image. The page calls this once per image, so a batch shows live progress. */
export async function POST(req: Request) {
  const refused = await refuseAi();
  if (refused) return refused;

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || !file.size) return Response.json({ error: 'No image received.' }, { status: 400 });
  if (!AI_IMAGE_TYPES.includes(file.type)) return Response.json({ error: 'Use a JPG, PNG, WebP or GIF image.' }, { status: 400 });
  if (file.size > AI_MAX_IMAGE_MB * 1024 * 1024) return Response.json({ error: `Images can be up to ${AI_MAX_IMAGE_MB} MB.` }, { status: 413 });

  let criteria: string[] = [];
  try { criteria = (JSON.parse(String(form?.get('criteria') ?? '[]')) as unknown[]).map(String).map((s) => s.trim()).filter(Boolean).slice(0, 60); } catch { /* treated as no criteria */ }
  const clientId = String(form?.get('clientId') ?? '') || null;
  const categoryId = String(form?.get('categoryId') ?? '') || null;
  const [client, category] = await Promise.all([
    clientId ? db.aiClient.findUnique({ where: { id: clientId } }) : null,
    categoryId ? db.aiCategory.findUnique({ where: { id: categoryId } }) : null,
  ]);

  const original = Buffer.from(await file.arrayBuffer());
  try {
    const { result, inputTokens, outputTokens } = await withSlot(async () => reviewWithClaude(await prepareForClaude(original), criteria));
    const imageFile = await saveAiImage(original, file.type);
    const saved = await db.aiReview.create({
      data: {
        clientId: client?.id ?? null, clientName: client?.name ?? null,
        categoryId: category?.id ?? null, categoryName: category?.name ?? null,
        originalFilename: (file.name || 'image').slice(0, 200), imageFile,
        score: result.score, verdict: result.verdict, summary: result.summary,
        actionItems: JSON.stringify(result.actionItems), checks: JSON.stringify(result.checks),
        criteriaSnapshot: JSON.stringify(criteria), inputTokens, outputTokens,
      },
    });
    recordReviewOutcome(true);
    return Response.json({ id: saved.id, imageFile, ...result, inputTokens, outputTokens });
  } catch (e) {
    // Nothing was judged, so nothing is saved. The message is shown on that image in the batch.
    const message = e instanceof AiFailure ? e.message : 'Something went wrong while reviewing this image.';
    if (!(e instanceof AiFailure)) console.error('ai review failed', e);
    recordReviewOutcome(false, message);
    return Response.json({ error: message }, { status: 502 });
  }
}
