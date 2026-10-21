import type { Check, Verdict } from '@/lib/aiShared';
import type { ReviewText } from '@/lib/aiTranslate';

export type Crit = { id: string; text: string };
export type AiClientLite = { id: string; name: string; notes: string | null; logo: string | null; base: Crit[]; categories: { id: string; name: string; criteria: Crit[] }[] };

/** What the detail panel needs to show one review, whether it just ran or comes from history. */
export type ReviewView = {
  id: string;
  imageFile: string;
  filename: string;
  score: number;
  verdict: Verdict;
  summary: string;
  actionItems: string[];
  checks: Check[];
  clientName?: string | null;
  clientLogo?: string | null;
  categoryName?: string | null;
  createdAt?: string;
  es?: ReviewText | null; // the Spanish version, when it has already been made
};
