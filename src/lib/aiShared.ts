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

// What is being reviewed. Social media has its own media types and checklists per client. Website and Food Menu have one shared list each.
export type Kind = 'social' | 'website' | 'menu';
export const AI_KINDS: { key: Kind; label: string }[] = [
  { key: 'social', label: 'Social media' },
  { key: 'website', label: 'Website' },
  { key: 'menu', label: 'Food Menu' },
];
/** Website and Food Menu are not tied to a client. Each has one shared list, kept on a fixed record. */
export const GENERAL: Partial<Record<Kind, { id: string; name: string }>> = {
  website: { id: 'general-website', name: 'General Website Review' },
  menu: { id: 'general-menu', name: 'General Food Menu' },
};
export const generalKind = (id: string): Kind | null => (Object.keys(GENERAL) as Kind[]).find((k) => GENERAL[k]!.id === id) ?? null;
export const isKind = (v: unknown): v is Kind => v === 'social' || v === 'website' || v === 'menu';
/** Social media is one small image per review. Website and Food Menu take images and PDFs, a few pages at a time. */
export const KIND_RULES: Record<Kind, { pdf: boolean; maxFileMb: number; maxPages: number }> = {
  social: { pdf: false, maxFileMb: 10, maxPages: 1 },
  website: { pdf: true, maxFileMb: 250, maxPages: 10 },
  menu: { pdf: true, maxFileMb: 250, maxPages: 10 },
};
/** A very tall page is cut into overlapping slices for the AI. This caps all the slices of one review. */
export const AI_MAX_SLICES = 30;

/** x and y are fractions of the page (y of its full height). page is 0-based and only set on multi-page reviews. */
export type Check = { criterion: string; status: 'pass' | 'warn' | 'fail'; comment: string; location?: { x: number; y: number; page?: number } };
export type PageRef = { file: string; w: number; h: number };
export type ReviewResult = { score: number; verdict: Verdict; summary: string; actionItems: string[]; checks: Check[] };

export const AI_MAX_IMAGE_MB = 10;
export const AI_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
