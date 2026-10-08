'use client';

import { useState } from 'react';

const LIMIT_MB = 95; // the server proxy accepts 100 MB per request

/** File input that tells the designer what they picked and warns before an upload that is too big. */
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
          const mb = files.reduce((n, f) => n + f.size, 0) / 1048576;
          const unsupported = files.find((f) => !/^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(f.type));
          if (unsupported) setNote({ text: `"${unsupported.name}" is not a supported type. Use JPG, PNG, WebP, GIF or PDF.`, bad: true });
          else if (mb > LIMIT_MB) setNote({ text: `${mb.toFixed(0)} MB is over the ${LIMIT_MB} MB upload limit. Upload fewer files at a time.`, bad: true });
          else setNote(files.length ? { text: `${files.length} file${files.length === 1 ? '' : 's'}, ${mb.toFixed(1)} MB. PDFs take a few seconds per page set to convert.`, bad: false } : null);
        }}
      />
      {note && <span className={`mt-1 block text-xs ${note.bad ? 'text-red-400' : 'text-zinc-500'}`}>{note.text}</span>}
    </>
  );
}
