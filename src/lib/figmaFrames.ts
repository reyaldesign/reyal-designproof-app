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
    const known = link.pages?.find((p) => p.id === node);
    const f = await exportFrame(link.file, node, known && known.w > 0 ? { name: known.name, w: known.w, h: known.h } : undefined);
    const again = await db.image.findFirst({ where: { versionId, frameId: node } });
    if (again) return again;
    const file = await saveJpeg(f.buf);
    const last = await db.image.aggregate({ where: { versionId }, _max: { position: true } });
    return db.image.create({ data: { versionId, file, position: (last._max.position ?? -1) + 1, frameId: node, frameName: f.name, device, fw: f.w, fh: f.h } });
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

const running = new Set<string>();
const lastTry = new Map<string, number>();
/**
 * Fetches every screen of a Figma proof that has no image yet, in the background: each size's first screen first, then the rest.
 * One queue per proof, and a proof is not tried again within a minute, so opening the page over and over cannot pile up requests.
 * Called when a proof is made, and again whenever the proof is opened, so screens that failed or were cut off by a restart are picked up.
 */
export function prefetchMissing(versionId: string, figmaJson: string | null) {
  const proof = parseFigma(figmaJson);
  if (!proof || running.has(versionId) || Date.now() - (lastTry.get(versionId) ?? 0) < 60_000) return;
  running.add(versionId);
  lastTry.set(versionId, Date.now());
  void (async () => {
    try {
      const have = new Set((await db.image.findMany({ where: { versionId, frameId: { not: null } }, select: { frameId: true } })).map((i) => i.frameId));
      const order = (['desktop', 'mobile', 'tablet'] as const).filter((d) => proof[d]?.start);
      const jobs: { d: (typeof order)[number]; n: string }[] = [];
      for (const d of order) jobs.push({ d, n: proof[d]!.start! }); // first screens first
      for (const d of order) for (const p of proof[d]!.pages ?? []) jobs.push({ d, n: p.id });
      const seen = new Set<string>();
      for (const { d, n } of jobs) {
        if (have.has(n) || seen.has(n)) continue;
        seen.add(n);
        try { await ensureFrame(versionId, d, n); } catch (e) { console.error('figma prefetch failed', d, n, e instanceof Error ? e.message : e); }
      }
    } finally { running.delete(versionId); }
  })();
}
export const prefetchStartFrames = prefetchMissing; // the name used when a proof is first made
