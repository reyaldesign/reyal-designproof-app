import { db } from './db';
import { figmaConfigured, parseFigma, postFigmaComment } from './figma';
import { isDevice } from './live';

/**
 * Posts a submitted revision's pinned comments into the Figma file, each on its screen at the spot the client clicked, so the designer sees them on the design.
 * One way: nothing in Figma is read back. A failure never affects the client's revision, which is already saved.
 */
export async function mirrorToFigma(versionId: string, submissionId: string, number: number, author: string) {
  try {
    if (!figmaConfigured()) return;
    const version = await db.version.findUnique({ where: { id: versionId } });
    const proof = parseFigma(version?.figma);
    if (!proof) return;
    const rows = await db.comment.findMany({ where: { submissionId, parentId: null, figmaId: null, imageId: { not: null }, x: { not: null }, y: { not: null } }, include: { image: true }, orderBy: { pin: 'asc' } });
    for (const c of rows) {
      const img = c.image;
      const link = img && isDevice(img.device) ? proof[img.device] : null;
      if (!img?.frameId || !link || !img.fw || !img.fh) continue;
      try {
        const id = await postFigmaComment(link.file, img.frameId, { x: (c.x! / 100) * img.fw, y: (c.y! / 100) * img.fh }, `${author} (client review, revision ${number}): ${c.text}`);
        if (id) await db.comment.update({ where: { id: c.id }, data: { figmaId: id } });
      } catch (e) {
        console.error('figma comment failed', c.id, e instanceof Error ? e.message : e);
      }
    }
  } catch (e) {
    console.error('figma mirror failed', e instanceof Error ? e.message : e);
  }
}
