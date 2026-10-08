/** "2 days ago" style label for card grids. */
export function timeAgo(d: Date, now = new Date()) {
  const s = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  const units: [number, string][] = [[31536000, 'year'], [2592000, 'month'], [604800, 'week'], [86400, 'day'], [3600, 'hour'], [60, 'minute']];
  for (const [secs, name] of units) {
    const n = Math.floor(s / secs);
    if (n >= 1) return `${n} ${name}${n === 1 ? '' : 's'} ago`;
  }
  return 'just now';
}

/** Short status letter and colour class for the small circles on cards. */
export const statusDot = (status: string) => ({ letter: status.charAt(0), cls: `kb-${status.split(' ')[0]}` });

/** Thumbnail URL for a stored image: a small version, never the full-size proof. */
export const thumb = (file: string, w: 320 | 640 = 640) => `/files/${file}?w=${w}`;
