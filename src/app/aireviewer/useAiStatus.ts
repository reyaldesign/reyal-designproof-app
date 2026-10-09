'use client';

import { useSyncExternalStore } from 'react';

export type LiveStatus = { state: 'checking' | 'active' | 'degraded' | 'down'; reason: string; checkedAt?: string };

// One shared status for the whole page: every indicator reads the same value, and only one check runs per minute.
let snap: LiveStatus = { state: 'checking', reason: 'Checking the AI connection…' };
const SERVER_SNAP: LiveStatus = snap;
const subs = new Set<() => void>();
let started = false;

export async function refreshAiStatus(fresh = true) {
  try {
    const r = await fetch(`/api/aireviewer/status${fresh ? '?fresh=1' : ''}`, { cache: 'no-store' });
    if (r.status === 401) { window.location.href = '/login'; return; }
    const j = (await r.json()) as LiveStatus;
    snap = { state: j.state, reason: j.reason, checkedAt: j.checkedAt };
  } catch {
    snap = { state: 'down', reason: 'Cannot reach the app. Check your connection.' };
  }
  subs.forEach((f) => f());
}

function subscribe(cb: () => void) {
  subs.add(cb);
  if (!started) {
    started = true;
    refreshAiStatus(false);
    setInterval(() => refreshAiStatus(false), 60_000);
    window.addEventListener('ai-status-refresh', () => refreshAiStatus(true));
  }
  return () => { subs.delete(cb); };
}

export const useAiStatus = () => useSyncExternalStore(subscribe, () => snap, () => SERVER_SNAP);
