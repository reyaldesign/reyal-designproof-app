'use client';

import { useState, useTransition } from 'react';
import { requestAccess } from './actions';

export default function RequestButton({ tool }: { tool: string }) {
  const [sent, setSent] = useState(false);
  const [busy, start] = useTransition();
  if (sent) return <span className="gate-ok">Request sent. The admins have been told.</span>;
  return <button className="btn" disabled={busy} onClick={() => start(async () => setSent((await requestAccess(tool)).ok))}>Request access</button>;
}
