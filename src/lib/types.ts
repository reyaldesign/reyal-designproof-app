// What a proof is for. Stored on each proof so the lists can be filtered by type.
export const PROOF_TYPES = [
  { value: 'website', label: 'Website', letter: 'W' },
  { value: 'social', label: 'Social media', letter: 'S' },
  { value: 'menu', label: 'Menu', letter: 'M' },
  { value: 'print', label: 'Prints', letter: 'P' },
] as const;

export type ProofType = (typeof PROOF_TYPES)[number]['value'];
export const isProofType = (v: string): v is ProofType => PROOF_TYPES.some((t) => t.value === v);
export const typeInfo = (v: string | null | undefined) => PROOF_TYPES.find((t) => t.value === v) ?? null;
