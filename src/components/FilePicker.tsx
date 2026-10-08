'use client';

import { useState } from 'react';
import { MAX_IMAGE_MB, MAX_PDF_MB, MAX_UPLOAD_MB } from '@/lib/limits';

const OK_TYPE = /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/;

/** Returns what is wrong with the chosen files, or '' when they are fine. */
function problem(files: File[]) {
  const mb = (n: number) => n / 1048576;
  for (const f of files) {
    if (!OK_TYPE.test(f.type)) return `"${f.name}" is not a supported type. Use JPG, PNG, WebP, GIF or PDF.`;
    const pdf = f.type === 'application/pdf';
    const max = pdf ? MAX_PDF_MB : MAX_IMAGE_MB;
    if (mb(f.size) > max) return `"${f.name}" is ${mb(f.size).toFixed(0)} MB. ${pdf ? 'PDFs' : 'Images'} can be up to ${max} MB. Export a smaller, web-sized preview instead of the final artwork.`;
  }
  const total = mb(files.reduce((n, f) => n + f.size, 0));
  if (total > MAX_UPLOAD_MB) return `These files total ${total.toFixed(0)} MB. Keep each upload under ${MAX_UPLOAD_MB} MB; you can add more pages later as a new version.`;
  return '';
}

/** File input that checks size and type before anything is sent, and blocks the form with a clear message. */
export default function FilePicker({ className = 'input mt-1' }: { className?: string }) {
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);
  return (
    <>
      <input
        className={className}
        name="files"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        multiple
        required
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          const bad = problem(files);
          e.target.setCustomValidity(bad); // stops the form from submitting and shows the message as a prompt
          if (bad) setNote({ text: bad, bad: true });
          else if (files.length) {
            const mb = files.reduce((n, f) => n + f.size, 0) / 1048576;
            setNote({ text: `${files.length} file${files.length === 1 ? '' : 's'}, ${mb.toFixed(1)} MB. PDFs take a few seconds to convert.`, bad: false });
          } else setNote(null);
        }}
      />
      {note && <span className={`mt-1 block text-xs ${note.bad ? 'text-red-400' : 'text-zinc-500'}`}>{note.text}</span>}
    </>
  );
}
