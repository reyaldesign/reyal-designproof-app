import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const uploadDir = () => path.resolve(process.env.DATA_DIR || './data', 'uploads');
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
export const MIME = Object.fromEntries(Object.entries(EXT).map(([m, e]) => [e, m]));
const MAX = 25 * 1024 * 1024;

/** Saves each valid image under an unguessable name and returns the stored file names. */
export async function saveImages(files: File[]) {
  await mkdir(uploadDir(), { recursive: true });
  const names: string[] = [];
  for (const f of files) {
    const ext = EXT[f.type];
    if (!ext || f.size > MAX || f.size === 0) continue;
    const name = `${randomBytes(18).toString('base64url')}.${ext}`;
    await writeFile(path.join(uploadDir(), name), Buffer.from(await f.arrayBuffer()));
    names.push(name);
  }
  return names;
}
