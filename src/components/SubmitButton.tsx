'use client';

import { useFormStatus } from 'react-dom';

/** Submit button that shows work is happening, so a slow upload never looks like "nothing happened". */
export default function SubmitButton({ children, pending: label = 'Working…', className = 'btn' }: { children: React.ReactNode; pending?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending} aria-busy={pending}>
      {pending ? label : children}
    </button>
  );
}
