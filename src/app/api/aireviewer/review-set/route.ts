import { AiFailure, GENERAL, refuseAi, reviewImages, withSlot } from '@/lib/ai';
import { TOKEN_RE, UploadError, renderPages, sliceCount, sliceTall, type Rendered } from '@/lib/aiPdf';
import { AI_MAX_SLICES, KIND_RULES, isKind, type Check, type PageRef } from '@/lib/aiShared';
import { recordReviewOutcome } from '@/lib/aiStatus';
import { saveAiImage } from '@/lib/aiStorage';
import { db } from '@/lib/db';

type In = {
  kind?: string; clientId?: string; categoryId?: string; criteria?: unknown[]; name?: string;
  sources?: { token?: string }[]; picks?: { si?: number; page?: number }[];
};

/** Reviews the chosen pages of one or more uploaded files as ONE review with one score. */
export async function POST(req: Request) {
  const refused = await refuseAi();
  if (refused) return refused;
  const body = (await req.json().catch(() => ({}))) as In;
  const kind = body.kind;
  if (!isKind(kind) || !KIND_RULES[kind].pdf) return Response.json({ error: 'This review type takes one image at a time.' }, { status: 400 });
  const rules = KIND_RULES[kind];

  const tokens = (body.sources ?? []).slice(0, rules.maxPages).map((s) => String(s?.token ?? ''));
  const picks = (body.picks ?? []).map((p) => ({ si: Number(p?.si), page: Number(p?.page) }));
  if (!tokens.length || !picks.length) return Response.json({ error: 'Choose at least one page.' }, { status: 400 });
  if (picks.length > rules.maxPages) return Response.json({ error: `A review can hold up to ${rules.maxPages} pages.` }, { status: 400 });
  if (picks.some((p) => !Number.isInteger(p.si) || p.si < 0 || p.si >= tokens.length || !Number.isInteger(p.page) || p.page < 0)) return Response.json({ error: 'A chosen page is not valid.' }, { status: 400 });
  if (tokens.some((t) => !TOKEN_RE.test(t))) return Response.json({ error: 'That upload is no longer available. Add the file again.' }, { status: 400 });

  const criteria = (body.criteria ?? []).map(String).map((s) => s.trim()).filter(Boolean).slice(0, 60);
  const [client, category] = await Promise.all([
    body.clientId ? db.aiClient.findUnique({ where: { id: String(body.clientId) } }) : null,
    body.categoryId ? db.aiCategory.findUnique({ where: { id: String(body.categoryId) } }) : null,
  ]);

  try {
    // Render each file once, for just the pages that were chosen.
    const rendered = new Map<string, Rendered>(); // "source:page" -> page image
    for (let si = 0; si < tokens.length; si++) {
      const wanted = [...new Set(picks.filter((p) => p.si === si).map((p) => p.page))];
      if (!wanted.length) continue;
      const out = await renderPages(tokens[si], wanted);
      wanted.forEach((pg, i) => rendered.set(`${si}:${pg}`, out[i]));
    }
    const pageImgs = picks.map((p) => rendered.get(`${p.si}:${p.page}`)!);
    const slicesTotal = pageImgs.reduce((n, r) => n + sliceCount(r.h), 0);
    if (slicesTotal > AI_MAX_SLICES) throw new UploadError(400, `These pages are very tall and would need ${slicesTotal} parts. A review can hold ${AI_MAX_SLICES}. Choose fewer pages.`);

    // What the AI sees: every page, tall ones in overlapping slices, each introduced by a label.
    const parts: { buf: Buffer; label: string }[] = [];
    const meta: { page: number; top: number; bottom: number; pageH: number }[] = [];
    for (let pi = 0; pi < pageImgs.length; pi++) {
      const slices = await sliceTall(pageImgs[pi]);
      slices.forEach((s, k) => {
        parts.push({ buf: s.buf, label: `Image ${parts.length + 1}: page ${pi + 1}${slices.length > 1 ? `, part ${k + 1} of ${slices.length}` : ''}` });
        meta.push({ page: pi, top: s.top, bottom: s.bottom, pageH: pageImgs[pi].h });
      });
    }
    const { result, inputTokens, outputTokens } = await withSlot(() => reviewImages(parts, criteria, client?.id === GENERAL[kind]?.id ? client?.notes : null)); // a shared list's reference guidance goes with every review of it

    // Put each marker on the page the AI meant, as a fraction of that page's full height.
    const checks: Check[] = result.checks.map(({ image, location, ...c }) => {
      if (!location) return c;
      const m = meta[(image ?? 1) - 1];
      if (!m) return c;
      return { ...c, location: { x: location.x, y: (m.top + location.y * (m.bottom - m.top)) / m.pageH, page: m.page } };
    });

    const files: PageRef[] = [];
    for (const r of pageImgs) files.push({ file: await saveAiImage(r.buf, 'image/jpeg'), w: r.w, h: r.h });
    const saved = await db.aiReview.create({
      data: {
        clientId: client?.id ?? null, clientName: client?.name ?? null,
        categoryId: category?.id ?? null, categoryName: category?.name ?? null,
        kind, originalFilename: String(body.name || 'Review').slice(0, 200), imageFile: files[0].file, pages: JSON.stringify(files),
        score: result.score, verdict: result.verdict, summary: result.summary,
        actionItems: JSON.stringify(result.actionItems), checks: JSON.stringify(checks),
        criteriaSnapshot: JSON.stringify(criteria), inputTokens, outputTokens,
      },
    });
    recordReviewOutcome(true);
    return Response.json({ id: saved.id, imageFile: files[0].file, pages: files, kind, ...result, checks, inputTokens, outputTokens });
  } catch (e) {
    if (e instanceof UploadError) return Response.json({ error: e.message }, { status: e.status });
    const message = e instanceof AiFailure ? e.message : 'Something went wrong while reviewing this file.';
    if (!(e instanceof AiFailure)) console.error('ai review-set failed', e);
    recordReviewOutcome(false, message);
    return Response.json({ error: message }, { status: 502 });
  }
}
