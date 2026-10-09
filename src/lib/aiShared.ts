// Constants and types the browser can safely import. Nothing server-only in this file.
export const READY_AT = 80;
export const NEEDS_AT = 50;
export type Verdict = 'approved' | 'needs_review' | 'rejected';
export const verdictFor = (score: number): Verdict => (score >= READY_AT ? 'approved' : score >= NEEDS_AT ? 'needs_review' : 'rejected');
export const VERDICT_LABEL: Record<Verdict, { label: string; short: string; cls: string }> = {
  approved: { label: 'Ready for proofing', short: 'Ready', cls: 'ready' },
  needs_review: { label: 'Needs revisions', short: 'Needs revisions', cls: 'needs' },
  rejected: { label: 'Fails', short: 'Fails', cls: 'fails' },
};

export type Check = { criterion: string; status: 'pass' | 'warn' | 'fail'; comment: string; location?: { x: number; y: number } };
export type ReviewResult = { score: number; verdict: Verdict; summary: string; actionItems: string[]; checks: Check[] };

export const AI_MAX_IMAGE_MB = 10;
export const AI_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
