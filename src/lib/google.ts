export const googleEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const base = (req: Request) => process.env.APP_URL || new URL(req.url).origin;
export const redirectUri = (req: Request) => `${base(req)}/api/auth/google/callback`;
export const to = (req: Request, path: string) => Response.redirect(new URL(path, base(req)), 303);

/** Who may sign in: any address on ALLOWED_EMAIL_DOMAIN (default reyaldesign.com) or listed in ALLOWED_EMAILS. */
export function isAllowed(email: string) {
  const e = email.toLowerCase();
  const domain = (process.env.ALLOWED_EMAIL_DOMAIN ?? 'reyaldesign.com').toLowerCase();
  const list = (process.env.ALLOWED_EMAILS ?? '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  return list.includes(e) || (!!domain && e.endsWith(`@${domain}`));
}
