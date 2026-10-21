import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, open, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import sharp from 'sharp';
import { uploadDir } from './storage';

// Website and Food Menu files can be big (up to 250 MB), so they are streamed to a temporary file instead of held in memory,
// looked at one page at a time, and deleted after 12 hours. Only the pages that get reviewed are kept, as small JPEGs.
const tmp = () => path.join(uploadDir(), 'ai', 'tmp');
const bin = (token: string) => path.join(tmp(), `${token}.bin`);
export const TOKEN_RE = /^[A-Za-z0-9_-]{24}$/;
export class UploadError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const PAGE_WIDTH = 1400; // every page is brought to this width for the AI
const MAX_PAGE_HEIGHT = 20000; // taller than this is shrunk, so one page cannot use up the memory
export const SLICE_AFTER = 2400; // a page taller than this is cut into slices
const SLICE_H = 1500;
const SLICE_OVERLAP = 100;
const THUMB_W = 220;
const MAX_THUMBS = 60; // pages offered for picking in one PDF

// One PDF at a time: opening a large one takes a lot of memory.
let busy = false;
const waiting: (() => void)[] = [];
export async function withPdfSlot<T>(fn: () => Promise<T>): Promise<T> {
  while (busy) await new Promise<void>((r) => waiting.push(r));
  busy = true;
  try { return await fn(); } finally { busy = false; waiting.shift()?.(); }
}

/** Removes uploads nobody finished with: anything older than 12 hours, and the oldest first if the folder passes 3 GB. Called on every new upload. */
export async function cleanupTmp(maxAgeMs = 12 * 3600_000, maxBytes = 3 * 1024 ** 3) {
  try {
    const files: { p: string; at: number; size: number }[] = [];
    for (const f of await readdir(tmp())) {
      const p = path.join(tmp(), f);
      const st = await stat(p);
      if (Date.now() - st.mtimeMs > maxAgeMs) await unlink(p).catch(() => {});
      else files.push({ p, at: st.mtimeMs, size: st.size });
    }
    let total = files.reduce((n, f) => n + f.size, 0);
    for (const f of files.sort((a, b) => a.at - b.at)) {
      if (total <= maxBytes) break;
      await unlink(f.p).catch(() => {});
      total -= f.size;
    }
  } catch { /* the folder does not exist yet */ }
}

/** Streams the request body to a temporary file, refusing anything over maxBytes. */
export async function saveUpload(req: Request, name: string, maxBytes: number): Promise<{ token: string; size: number }> {
  if (!req.body) throw new UploadError(400, 'No file received.');
  await mkdir(tmp(), { recursive: true });
  const token = randomBytes(18).toString('base64url');
  let size = 0;
  const counter = new Transform({
    transform(chunk, _enc, cb) { size += chunk.length; cb(size > maxBytes ? new UploadError(413, 'That file is too big.') : null, chunk); },
  });
  try {
    await pipeline(Readable.fromWeb(req.body as never), counter, createWriteStream(bin(token)));
  } catch (e) {
    await unlink(bin(token)).catch(() => {});
    throw e instanceof UploadError ? e : new UploadError(400, 'The upload was interrupted. Try again.');
  }
  if (!size) { await unlink(bin(token)).catch(() => {}); throw new UploadError(400, 'No file received.'); }
  await writeFile(path.join(tmp(), `${token}.json`), JSON.stringify({ name: name.slice(0, 200), size, at: Date.now() }));
  return { token, size };
}

/** Deletes an upload that could not be used. */
export async function discard(token: string) {
  if (!TOKEN_RE.test(token)) return;
  await Promise.all([bin(token), path.join(tmp(), `${token}.json`)].map((f) => unlink(f).catch(() => {})));
}

export async function readMeta(token: string): Promise<{ name: string; size: number } | null> {
  if (!TOKEN_RE.test(token)) return null;
  try { return JSON.parse(await readFile(path.join(tmp(), `${token}.json`), 'utf8')) as { name: string; size: number }; } catch { return null; }
}

async function isPdf(token: string) {
  const fh = await open(bin(token), 'r');
  try { const b = Buffer.alloc(5); await fh.read(b, 0, 5, 0); return b.toString('latin1') === '%PDF-'; } finally { await fh.close(); }
}

async function openPdf(token: string) {
  const mupdf = await import('mupdf');
  let doc;
  try { doc = mupdf.Document.openDocument(await readFile(bin(token)), 'application/pdf'); } catch { throw new UploadError(422, 'That PDF could not be read.'); }
  if (doc.needsPassword()) { free(doc); throw new UploadError(422, 'That PDF is password protected. Remove the password and try again.'); }
  return { mupdf, doc };
}
const free = (doc: unknown) => { try { (doc as { destroy?: () => void }).destroy?.(); } catch { /* already freed */ } };

export type Inspected = { type: 'pdf' | 'image'; pages: number; thumbs: string[]; capped: boolean };

/** What an upload is, how many pages it has, and a small preview of each page for the picker. */
export async function inspect(token: string): Promise<Inspected> {
  if (await isPdf(token)) {
    return withPdfSlot(async () => {
      const { mupdf, doc } = await openPdf(token);
      try {
        const pages = doc.countPages();
        if (!pages) throw new UploadError(422, 'That PDF has no pages.');
        const thumbs: string[] = [];
        for (let i = 0; i < Math.min(pages, MAX_THUMBS); i++) {
          const page = doc.loadPage(i);
          const [x0, , x1] = page.getBounds();
          const s = THUMB_W / Math.max(1, x1 - x0);
          const pix = page.toPixmap(mupdf.Matrix.scale(s, s), mupdf.ColorSpace.DeviceRGB, false, true);
          thumbs.push(`data:image/jpeg;base64,${Buffer.from(pix.asJPEG(70, false)).toString('base64')}`);
        }
        return { type: 'pdf' as const, pages, thumbs, capped: pages > MAX_THUMBS };
      } finally { free(doc); }
    });
  }
  let format: string | undefined;
  try { format = (await sharp(bin(token), { limitInputPixels: 400_000_000 }).metadata()).format; } catch { /* not an image */ }
  if (!format || !['jpeg', 'png', 'webp', 'gif'].includes(format)) throw new UploadError(415, 'Use a PDF, or a JPG, PNG, WebP or GIF image.');
  const thumb = await sharp(bin(token), { limitInputPixels: 400_000_000 }).rotate().resize({ width: THUMB_W, withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 70 }).toBuffer();
  return { type: 'image', pages: 1, thumbs: [`data:image/jpeg;base64,${thumb.toString('base64')}`], capped: false };
}

export type Rendered = { buf: Buffer; w: number; h: number };

/** The chosen pages of one upload, each brought to PAGE_WIDTH. The file is opened once for all of them. */
export async function renderPages(token: string, pages: number[]): Promise<Rendered[]> {
  if (!(await readMeta(token))) throw new UploadError(404, 'That upload is no longer available. Add the file again.');
  if (!(await isPdf(token))) {
    const { data, info } = await sharp(bin(token), { limitInputPixels: 400_000_000 }).rotate()
      .resize({ width: PAGE_WIDTH, height: MAX_PAGE_HEIGHT, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
    return pages.map(() => ({ buf: data, w: info.width, h: info.height }));
  }
  return withPdfSlot(async () => {
    const { mupdf, doc } = await openPdf(token);
    try {
      const count = doc.countPages();
      return pages.map((n) => {
        if (n < 0 || n >= count) throw new UploadError(400, 'A chosen page does not exist.');
        const page = doc.loadPage(n);
        const [x0, y0, x1, y1] = page.getBounds();
        let s = PAGE_WIDTH / Math.max(1, x1 - x0);
        if ((y1 - y0) * s > MAX_PAGE_HEIGHT) s = MAX_PAGE_HEIGHT / Math.max(1, y1 - y0);
        const pix = page.toPixmap(mupdf.Matrix.scale(s, s), mupdf.ColorSpace.DeviceRGB, false, true);
        return { buf: Buffer.from(pix.asJPEG(85, false)), w: pix.getWidth(), h: pix.getHeight() };
      });
    } finally { free(doc); }
  });
}

/** A very tall page is cut into slices that overlap a little, so small text stays readable for the AI. */
export async function sliceTall(r: Rendered): Promise<{ buf: Buffer; top: number; bottom: number }[]> {
  if (r.h <= SLICE_AFTER) return [{ buf: r.buf, top: 0, bottom: r.h }];
  const out: { buf: Buffer; top: number; bottom: number }[] = [];
  let top = 0;
  for (;;) {
    const bottom = Math.min(top + SLICE_H, r.h);
    out.push({ top, bottom, buf: await sharp(r.buf).extract({ left: 0, top, width: r.w, height: bottom - top }).jpeg({ quality: 85 }).toBuffer() });
    if (bottom >= r.h) break;
    top = bottom - SLICE_OVERLAP;
  }
  return out;
}

/** How many slices a page of this height will become, without cutting it. */
export const sliceCount = (h: number) => (h <= SLICE_AFTER ? 1 : 1 + Math.ceil((h - SLICE_H) / (SLICE_H - SLICE_OVERLAP)));
