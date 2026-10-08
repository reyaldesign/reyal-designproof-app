import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from '@/lib/db';
import { uploadDir } from '@/lib/storage';

/** Quick self-test: can the app reach its database and write uploads? Safe to expose, it reveals only ok/not ok. */
export async function GET() {
  const checks = { db: false, uploads: false };
  try {
    await db.$queryRaw`SELECT 1`;
    checks.db = true;
  } catch (e) {
    console.error('health: db', e);
  }
  try {
    await mkdir(uploadDir(), { recursive: true });
    const f = path.join(uploadDir(), `.health-${randomBytes(4).toString('hex')}`);
    await writeFile(f, 'ok');
    await unlink(f);
    checks.uploads = true;
  } catch (e) {
    console.error('health: uploads', e);
  }
  const ok = checks.db && checks.uploads;
  return Response.json({ ok, ...checks }, { status: ok ? 200 : 503 });
}
