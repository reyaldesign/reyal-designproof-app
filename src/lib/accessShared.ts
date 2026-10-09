// Browser-safe: no server imports, so client components can use these.
export const TOOLS = [
  { key: 'PROOFS', label: 'Clients & proofs', d: 'Create proofs, upload versions, reply to comments', href: '/admin' },
  { key: 'REQUESTS', label: 'Requests', d: 'Inbox of open client comments', href: '/admin/requests' },
  { key: 'AI_REVIEW', label: 'AI Review', d: 'Grade images against client criteria', href: '/aireviewer' },
  { key: 'AI_CRITERIA', label: 'AI criteria', d: "Edit each client's review criteria", href: '/aireviewer/clients' },
  { key: 'CLICKUP', label: 'ClickUp', d: 'See and update ClickUp tasks on a board', href: '/clickup' },
  { key: 'TEAM', label: 'Team & access', d: 'Manage roles and see sign-ins', href: '/admin/team' },
] as const;
export type Tool = (typeof TOOLS)[number]['key'];
export const toolLabel = (k: string) => TOOLS.find((t) => t.key === k)?.label ?? k;
export const ROLES = ['ADMIN', 'PM', 'DESIGNER'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Admin', PM: 'Project Manager', DESIGNER: 'Designer' };
export const isRole = (s: string): s is Role => (ROLES as readonly string[]).includes(s);
export const isTool = (s: string): s is Tool => TOOLS.some((t) => t.key === s);
