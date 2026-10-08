'use client';

import { useEffect, useRef } from 'react';

/** A button that opens a pop-up holding whatever the server page passes in as children. */
export default function Dialog({ label, title, children, defaultOpen = false, wide = false, ghost = false }: {
  label: string; title: string; children: React.ReactNode; defaultOpen?: boolean; wide?: boolean; ghost?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (defaultOpen) ref.current?.showModal(); }, [defaultOpen]);
  return (
    <>
      <button className={ghost ? 'btn' : 'btn btn-primary'} onClick={() => ref.current?.showModal()}>{label}</button>
      <dialog ref={ref} className="dlg" style={wide ? { width: 'min(640px, calc(100vw - 32px))' } : undefined} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        <h2>{title}</h2>
        {children}
      </dialog>
    </>
  );
}
