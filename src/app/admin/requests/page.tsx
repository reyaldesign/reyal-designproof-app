import Link from 'next/link';
import { db } from '@/lib/db';
import { thumb, timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

/** Every open client comment across all proofs, newest first. */
export default async function Requests() {
  const open = await db.comment.findMany({
    where: { parentId: null, resolved: false, fromDesigner: false },
    orderBy: { createdAt: 'desc' },
    include: { image: true, version: { include: { project: { include: { client: true } } } } },
  });
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Reyal Proof</div>
          <h1 className="h1">Requests <span className="count">{open.length}</span></h1>
          <p className="muted" style={{ marginTop: 8 }}>Open comments from clients. Resolve them on the proof page.</p>
        </div>
      </div>
      <div className="req-list">
        {!open.length && <div className="empty-state"><h2>All caught up</h2><p>No open comments right now.</p></div>}
        {open.map((c) => {
          const p = c.version.project;
          const page = c.image ? `Page ${c.image.position + 1}` : 'General';
          return (
            <Link key={c.id} href={`/admin/${p.id}`} className="req">
              <div className="req-thumb">{c.image && <img src={thumb(c.image.file, 320)} alt="" loading="lazy" />}</div>
              <div>
                <div style={{ fontWeight: 600 }}>{c.text.length > 140 ? `${c.text.slice(0, 140)}…` : c.text}</div>
                <div className="req-meta">{p.client.name} / {p.title} · v{c.version.number} · {page}{c.pin != null && ` · pin ${c.pin}`} · {c.author}</div>
              </div>
              <span className="ago">{timeAgo(c.createdAt)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
