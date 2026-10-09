'use client';

import { useRef, useState } from 'react';
import { MAX_ATTACH_MB } from '@/lib/limits';

// Fields that save the moment they change, so the task panel needs no Save buttons.
const send = (e: { currentTarget: { form: HTMLFormElement | null } }) => e.currentTarget.form?.requestSubmit();

export function AutoDate(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} type="date" onChange={send} />;
}

/** The task title: saves on Enter (the form's own submit) or when you click away, but only if it changed. */
export function AutoText({ defaultValue, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} defaultValue={defaultValue} onBlur={(e) => { if (e.currentTarget.value.trim() !== String(defaultValue ?? '')) send(e); }} />;
}

/** A paperclip that opens the file picker and sends the form as soon as files are chosen. */
export function AttachButton() {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={input} type="file" name="files" multiple hidden
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files ?? []);
          if (files.some((f) => f.size > MAX_ATTACH_MB * 1048576)) { alert(`Each file can be up to ${MAX_ATTACH_MB} MB.`); e.currentTarget.value = ''; return; }
          if (files.length) { setBusy(true); send(e); }
        }}
      />
      <button type="button" className="cu-clip" disabled={busy} onClick={() => input.current?.click()} aria-label="Attach files" title="Attach files">{busy ? '…' : '📎'}</button>
    </>
  );
}
