import { db } from '@/lib/db';
import { FigmaError, NODE_RE, parseFigma } from '@/lib/figma';
import { ensureFrame } from '@/lib/figmaFrames';
import { isDevice } from '@/lib/live';
import { loadProject } from '@/lib/review';

// The first time a client comments on a screen of a Figma prototype, that screen is exported from Figma once and kept with the proof.
const recent = new Map<string, number[]>();
const limited = (key: string, max: number, windowMs: number) => {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  recent.set(key, hits);
  return hits.length > max;
};

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { project, access } = await loadProject(slug);
  if (!project || access !== 'ok') return Response.json({ error: 'Not allowed' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { versionId?: string; node?: string; device?: string };
  const version = await db.version.findFirst({ where: { id: body.versionId, projectId: project.id } });
  const proof = parseFigma(version?.figma);
  const device = body.device;
  const node = String(body.node ?? '');
  if (!version || !proof || !isDevice(device) || !proof[device] || !NODE_RE.test(node)) return Response.json({ error: 'That screen is not part of this proof.' }, { status: 400 });
  if (!(await db.image.findFirst({ where: { versionId: version.id, frameId: node } })) && limited(`frame:${slug}`, 40, 10 * 60_000)) return Response.json({ error: 'Too many screens requested. Wait a few minutes.' }, { status: 429 });
  try {
    const i = await ensureFrame(version.id, device, node);
    return Response.json({ image: { id: i.id, file: i.file, frameId: i.frameId, frameName: i.frameName, device: i.device, fw: i.fw, fh: i.fh } });
  } catch (e) {
    if (e instanceof FigmaError) return Response.json({ error: e.message }, { status: e.status === 429 ? 429 : 502 });
    console.error('figma frame export failed', e);
    return Response.json({ error: e instanceof Error && /screen/.test(e.message) ? e.message : 'Could not load that screen from Figma.' }, { status: 502 });
  }
}
