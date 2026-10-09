// How a proof's status reads on the designer side. "With client" means the ball is in the client's court.
export const STATUS = {
  Draft: { label: 'Draft', cls: 'st-draft', color: '#a1a1aa', short: 'draft' },
  Sent: { label: 'With client', cls: 'st-sent', color: '#ff8a4c', short: 'with client' },
  'Feedback Received': { label: 'Feedback received', cls: 'st-feedback', color: '#ff6b7a', short: 'feedback' },
  Approved: { label: 'Approved', cls: 'st-approved', color: '#3ddc97', short: 'approved' },
} as const;

export type StatusKey = keyof typeof STATUS;
export const statusOf = (s: string) => STATUS[s as StatusKey] ?? STATUS.Draft;
// Order used when summarising a client's proofs: what needs the team first.
export const STATUS_ORDER: StatusKey[] = ['Feedback Received', 'Sent', 'Draft', 'Approved'];
