const COLORS = ['#a20e26', '#ff6319', '#0039a6', '#00933c', '#7c3aed', '#0e7490', '#b45309', '#be185d'];

/** A client's icon: their uploaded logo, or a colored initial that is the same every time for the same name. */
export default function ClientIcon({ name, logo, size = 36 }: { name: string; logo?: string | null; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) } as const;
  if (logo) return <img className="ai-cicon" style={style} src={`/aireviewer/img/${logo}`} alt="" loading="lazy" />;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return <span className="ai-cicon init" style={{ ...style, background: COLORS[h % COLORS.length] }} aria-hidden="true">{(name.trim().charAt(0) || '?').toUpperCase()}</span>;
}
