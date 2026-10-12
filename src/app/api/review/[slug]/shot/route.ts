import { loadProject } from '@/lib/review';
import { saveShot } from '@/lib/storage';

// The review page uploads a screenshot as soon as a comment is started, so Send revision only carries file names.
const recent = new Map<string, number[]>();
const limited = (key: string, max: number, windowMs: number) => {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  recent.set(key, hits);
  if (recent.size > 2000) for (const [k, v] of recent) if (!v.some((t) => now - t < windowMs)) recent.delete(k);
  return hits.length > max;
};

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { project, access } = await loadProject(slug);
  if (!project || access !== 'ok') return Response.json({ error: 'Not allowed' }, { status: 403 });
  if (limited(`shot:${slug}`, 120, 10 * 60_000)) return Response.json({ error: 'Too many screenshots. Wait a few minutes.' }, { status: 429 });
  const { dataUrl } = (await req.json().catch(() => ({}))) as { dataUrl?: string };
  const name = typeof dataUrl === 'string' ? await saveShot(dataUrl) : null;
  if (!name) return Response.json({ error: 'Could not use that screenshot.' }, { status: 400 });
  return Response.json({ name });
}
