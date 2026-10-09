// Slows down password guessing on the ADMIN_EMAIL login. Kept in memory: a restart resets it, which is fine for a 15 minute window.
const WINDOW = 15 * 60_000;
const MAX_PER_IP = 5; // wrong passwords from one address
const MAX_PER_EMAIL = 10; // wrong passwords for one email, from anywhere

type Rec = { n: number; first: number };
const g = globalThis as unknown as { loginFails?: Map<string, Rec> };
const fails = g.loginFails ?? (g.loginFails = new Map());

const read = (k: string) => {
  const r = fails.get(k);
  if (r && Date.now() - r.first > WINDOW) { fails.delete(k); return undefined; }
  return r;
};

export const isLocked = (ip: string, email: string) => (read(`ip:${ip}`)?.n ?? 0) >= MAX_PER_IP || (read(`em:${email}`)?.n ?? 0) >= MAX_PER_EMAIL;

export function noteFail(ip: string, email: string) {
  if (fails.size > 5000) for (const k of [...fails.keys()]) read(k); // drop expired entries
  for (const k of [`ip:${ip}`, `em:${email}`]) {
    const r = read(k);
    fails.set(k, r ? { n: r.n + 1, first: r.first } : { n: 1, first: Date.now() });
  }
}

export function clearFails(ip: string, email: string) {
  fails.delete(`ip:${ip}`);
  fails.delete(`em:${email}`);
}
