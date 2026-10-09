import { refuseAi } from '@/lib/ai';
import { readAiImage } from '@/lib/aiStorage';

// Reviewed images are internal: only signed-in users can open them (unlike proof images, which use unguessable public links).
export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const refused = await refuseAi();
  if (refused) return refused;
  const { name } = await params;
  const w = Number(new URL(req.url).searchParams.get('w'));
  const img = await readAiImage(name, [320, 640, 1280].includes(w) ? w : undefined);
  if (!img) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(img.buf), { headers: { 'Content-Type': img.mime, 'Cache-Control': 'private, max-age=31536000, immutable' } });
}
