import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MAX_IMAGE_MB, MAX_PDF_MB, MAX_PDF_PAGES } from './limits';

export const uploadDir = () => path.resolve(process.env.DATA_DIR || './data', 'uploads');
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
export const MIME = Object.fromEntries(Object.entries(EXT).map(([m, e]) => [e, m]));
const MAX_IMAGE = MAX_IMAGE_MB * 1024 * 1024;
const MAX_PDF = MAX_PDF_MB * 1024 * 1024;
const PDF_PAGE_WIDTH = 4500; // px each PDF page is rendered at, so zooming in up to ~4x stays sharp
const PDF_MAX_SIDE = 9000; // keeps very tall pages from producing huge files

const newName = (ext: string) => `${randomBytes(18).toString('base64url')}.${ext}`;
const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

/** Renders each PDF page to a JPEG so PDFs behave like any multi-image proof. */
async function pdfToJpegs(buf: Buffer) {
  const mupdf = await import('mupdf');
  const doc = mupdf.Document.openDocument(buf, 'application/pdf');
  const pages: Uint8Array[] = [];
  for (let i = 0; i < Math.min(doc.countPages(), MAX_PDF_PAGES); i++) {
    const page = doc.loadPage(i);
    const [x0, y0, x1, y1] = page.getBounds();
    const s = Math.min(PDF_PAGE_WIDTH / Math.max(1, x1 - x0), PDF_MAX_SIDE / Math.max(1, y1 - y0));
    const pix = page.toPixmap(mupdf.Matrix.scale(s, s), mupdf.ColorSpace.DeviceRGB, false, true);
    pages.push(pix.asJPEG(92, false));
  }
  return pages;
}

/** Saves each valid image, or each page of a PDF, under an unguessable name and returns the stored file names. */
export async function saveImages(files: File[]) {
  await mkdir(uploadDir(), { recursive: true });
  const names: string[] = [];
  const write = async (data: Uint8Array, ext: string) => {
    const name = newName(ext);
    await writeFile(path.join(uploadDir(), name), data);
    names.push(name);
  };
  for (const f of files) {
    if (f.size === 0) continue;
    if (isPdf(f)) {
      if (f.size > MAX_PDF) continue;
      try {
        for (const jpg of await pdfToJpegs(Buffer.from(await f.arrayBuffer()))) await write(jpg, 'jpg');
      } catch (e) {
        console.error('pdf conversion failed', e); // unreadable or encrypted PDF: skip it, the form reports "no valid files"
      }
      continue;
    }
    const ext = EXT[f.type];
    if (ext && f.size <= MAX_IMAGE) await write(Buffer.from(await f.arrayBuffer()), ext);
  }
  return names;
}

/** Deletes stored images and their cached thumbnails. Missing files are ignored. */
export async function removeUploads(names: string[]) {
  await Promise.all(
    names
      .filter((n) => /^[\w-]+\.(jpg|png|webp|gif)$/.test(n))
      .flatMap((n) => [n, `thumbs/320-${n}.jpg`, `thumbs/640-${n}.jpg`])
      .map((rel) => unlink(path.join(uploadDir(), rel)).catch(() => {})),
  );
}
