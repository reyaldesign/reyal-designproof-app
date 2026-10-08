import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MIME, uploadDir } from '@/lib/storage';

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const m = /^[\w-]+\.(jpg|png|webp|gif)$/.exec(name);
  if (!m) return new Response('Not found', { status: 404 });
  try {
    const buf = await readFile(path.join(uploadDir(), name));
    return new Response(buf, {
      headers: { 'Content-Type': MIME[m[1]], 'Cache-Control': 'private, max-age=31536000, immutable' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
