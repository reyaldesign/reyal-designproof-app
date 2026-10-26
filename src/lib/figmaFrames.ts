import { db } from './db';
import { exportFrame, parseFigma } from './figma';
import { isDevice } from './live';
import { saveJpeg } from './storage';

export const MAX_FRAMES = 80; // screens kept per version
const inflight = new Map<string, Promise<ImageRow>>();
type ImageRow = NonNullable<Awaited<ReturnType<typeof db.image.findFirst>>>;

/** The stored image of one screen of a Figma proof. It is exported from Figma the first time it is asked for (a long page takes Figma about a minute), and kept. */
export async function ensureFrame(versionId: string, device: string, node: string): Promise<ImageRow> {
  const have = await db.image.findFirst({ where: { versionId, frameId: node } });
  if (have) return have;
  const key = `${versionId}:${node}`;
  const running = inflight.get(key);
  if (running) return running;
  const job = (async () => {
    const version = await db.version.findUnique({ where: { id: versionId } });
    const link = isDevice(device) ? parseFigma(version?.figma)?.[device] : null;
    if (!version || !link) throw new Error('That screen is not part of this proof.');
    if ((await db.image.count({ where: { versionId } })) >= MAX_FRAMES) throw new Error('This proof has reached its screen limit.');
    const f = await exportFrame(link.file, node);
    const again = await db.image.findFirst({ where: { versionId, frameId: node } });
    if (again) return again;
    const file = await saveJpeg(f.buf);
    const last = await db.image.aggregate({ where: { versionId }, _max: { position: true } });
    return db.image.create({ data: { versionId, file, position: (last._max.position ?? -1) + 1, frameId: node, frameName: f.name, device, fw: f.w, fh: f.h } });
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

/** Exports each size's starting screen in the background, right after a Figma proof is made, so the first comment does not wait on Figma. */
export function prefetchStartFrames(versionId: string, figmaJson: string | null) {
  const proof = parseFigma(figmaJson);
  if (!proof) return;
  void (async () => {
    for (const d of ['desktop', 'tablet', 'mobile'] as const) {
      const l = proof[d];
      if (!l?.start) continue;
      try { await ensureFrame(versionId, d, l.start); } catch (e) { console.error('figma prefetch failed', d, e instanceof Error ? e.message : e); }
    }
  })();
}
