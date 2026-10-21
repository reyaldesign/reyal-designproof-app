import { refuseAi } from '@/lib/ai';
import { UploadError, cleanupTmp, discard, inspect, saveUpload } from '@/lib/aiPdf';
import { KIND_RULES, isKind } from '@/lib/aiShared';

/** Takes one Website or Food Menu file (an image or a PDF), streams it to a temporary file and returns a small preview of every page. */
export async function POST(req: Request) {
  const refused = await refuseAi();
  if (refused) return refused;
  const kind = new URL(req.url).searchParams.get('kind');
  if (!isKind(kind) || !KIND_RULES[kind].pdf) return Response.json({ error: 'This review type takes one image at a time.' }, { status: 400 });
  const max = KIND_RULES[kind].maxFileMb * 1024 * 1024;
  const tooBig = `Files can be up to ${KIND_RULES[kind].maxFileMb} MB.`;
  if (Number(req.headers.get('content-length')) > max) return Response.json({ error: tooBig }, { status: 413 });

  let name = 'file';
  try { name = decodeURIComponent(req.headers.get('x-filename') ?? 'file'); } catch { /* keep the default */ }
  void cleanupTmp();
  let token = '';
  try {
    const saved = await saveUpload(req, name, max);
    token = saved.token;
    const info = await inspect(token);
    return Response.json({ token, name, size: saved.size, ...info });
  } catch (e) {
    if (token) await discard(token);
    if (e instanceof UploadError) return Response.json({ error: e.status === 413 ? tooBig : e.message }, { status: e.status });
    console.error('ai upload failed', e);
    return Response.json({ error: 'That file could not be read.' }, { status: 500 });
  }
}
