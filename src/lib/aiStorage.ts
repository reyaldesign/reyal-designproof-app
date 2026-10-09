import { randomBytes } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { uploadDir } from './storage';

// Reviewed images are internal working files. They live in their own folder and are only served to signed-in users.
const dir = () => path.join(uploadDir(), 'ai');
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const MIME: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
export const aiImageMime = (name: string) => MIME[name.split('.').pop() ?? ''] ?? 'application/octet-stream';
export const isAiImageName = (n: string) => /^[\w-]+\.(jpg|png|webp|gif)$/.test(n);

export async function saveAiImage(buf: Buffer, mime: string) {
  await mkdir(dir(), { recursive: true });
  const name = `${randomBytes(18).toString('base64url')}.${EXT[mime] ?? 'jpg'}`;
  await writeFile(path.join(dir(), name), buf);
  return name;
}

export async function readAiImage(name: string, width?: number) {
  if (!isAiImageName(name)) return null;
  try {
    if (width) {
      const cached = path.join(dir(), 'thumbs', `${width}-${name}.jpg`);
      try { return { buf: await readFile(cached), mime: 'image/jpeg' }; } catch { /* not cached yet */ }
      const buf = await sharp(await readFile(path.join(dir(), name)), { limitInputPixels: 200_000_000 })
        .rotate().resize({ width, withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 78 }).toBuffer();
      await mkdir(path.join(dir(), 'thumbs'), { recursive: true });
      await writeFile(cached, buf).catch(() => {});
      return { buf, mime: 'image/jpeg' };
    }
    return { buf: await readFile(path.join(dir(), name)), mime: aiImageMime(name) };
  } catch {
    return null;
  }
}

export async function removeAiImages(names: string[]) {
  await Promise.all(names.filter(isAiImageName).flatMap((n) => [n, `thumbs/320-${n}.jpg`, `thumbs/640-${n}.jpg`]).map((rel) => unlink(path.join(dir(), rel)).catch(() => {})));
}
