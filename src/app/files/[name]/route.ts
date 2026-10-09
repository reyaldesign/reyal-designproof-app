import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { MIME, uploadDir } from '@/lib/storage';

const THUMB_WIDTHS = new Set([320, 640, 1280]);
const HEADERS = { 'Cache-Control': 'private, max-age=31536000, immutable' };

export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const m = /^[\w-]+\.(jpg|png|webp|gif)$/.exec(name);
  if (!m) return new Response('Not found', { status: 404 });
  const w = Number(new URL(req.url).searchParams.get('w'));
  try {
    if (THUMB_WIDTHS.has(w)) {
      // Small preview for card grids, made on first request and kept on disk. Full-size proofs are never used as thumbnails.
      const cached = path.join(uploadDir(), 'thumbs', `${w}-${name}.jpg`);
      try {
        return new Response(await readFile(cached), { headers: { ...HEADERS, 'Content-Type': 'image/jpeg' } });
      } catch { /* not cached yet */ }
      const thumb = await sharp(await readFile(path.join(uploadDir(), name)), { limitInputPixels: 200_000_000 })
        .resize({ width: w, withoutEnlargement: true })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 78 })
        .toBuffer();
      await mkdir(path.dirname(cached), { recursive: true });
      await writeFile(cached, thumb).catch(() => {});
      return new Response(new Uint8Array(thumb), { headers: { ...HEADERS, 'Content-Type': 'image/jpeg' } });
    }
    const buf = await readFile(path.join(uploadDir(), name));
    return new Response(buf, { headers: { ...HEADERS, 'Content-Type': MIME[m[1]] } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
