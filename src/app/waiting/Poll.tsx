'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Re-checks the page every 15 seconds and when the tab comes back into view. */
export default function Poll() {
  const router = useRouter();
  useEffect(() => {
    const go = () => { if (!document.hidden) router.refresh(); };
    const t = setInterval(go, 15_000);
    document.addEventListener('visibilitychange', go);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', go); };
  }, [router]);
  return null;
}
