import Link from 'next/link';
import { notFound } from 'next/navigation';
import FilePicker from '@/components/FilePicker';
import SubmitButton from '@/components/SubmitButton';
import { db } from '@/lib/db';
import { statusDot, thumb, timeAgo } from '@/lib/format';
import { clientActivity } from '@/lib/activity';
import { createProject, deleteClient, updateClient } from '../../actions';
import Dialog from '../../Dialog';

export const dynamic = 'force-dynamic';

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  const client = await db.client.findUnique({
    where: { id },
    include: {
      projects: {
        orderBy: { createdAt: 'desc' },
        include: {
          versions: {
            orderBy: { number: 'desc' },
            include: { images: { orderBy: { position: 'asc' }, take: 1 }, comments: { where: { parentId: null, resolved: false, fromDesigner: false } } },
          },
        },
      },
    },
  });
  if (!client) notFound();
  const activity = await clientActivity(client.id);

  return (
    <div className="page">
      <div className="crumbs"><Link href="/admin">Clients</Link></div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Client</div>
          <h1 className="h1">{client.name} <span className="count">{client.projects.length}</span></h1>
          <p className="muted" style={{ marginTop: 8 }}>{[client.email, client.notes].filter(Boolean).join(' · ') || 'No contact details'} · {client.revisionsIncluded} included revision{client.revisionsIncluded === 1 ? '' : 's'} per proof</p>
        </div>
        <div className="head-actions">
          <Dialog label="Edit client" title="Edit client" ghost>
            <form action={updateClient} style={{ display: 'grid', gap: 12 }}>
              <input type="hidden" name="id" value={client.id} />
              <input className="input" name="name" defaultValue={client.name} placeholder="Client name" required />
              <input className="input" name="email" type="email" defaultValue={client.email ?? ''} placeholder="Contact email (optional)" />
              <input className="input" name="notes" defaultValue={client.notes ?? ''} placeholder="Notes (optional)" />
              <label className="muted">Included revisions per proof
                <input className="input" style={{ marginTop: 4 }} name="revisionsIncluded" type="number" min={0} max={20} defaultValue={client.revisionsIncluded} required />
              </label>
              <p className="muted" style={{ fontSize: 12 }}>Each time this client presses Send Revision, one revision is used. When they run out they can no longer send, until you raise this number. A single proof can override it in its settings.</p>
              <SubmitButton className="btn btn-primary" pending="Saving…">Save client</SubmitButton>
            </form>
          </Dialog>
          <Dialog label="+ New proof" title={`New proof for ${client.name}`} defaultOpen={!!error} wide>
            <form action={createProject} style={{ display: 'grid', gap: 12 }}>
              <input type="hidden" name="clientId" value={client.id} />
              <input className="input" name="title" placeholder="Proof title (e.g. Menu - Main)" required />
              <input className="input" name="label" placeholder='Version label (e.g. "changes #40")' />
              <input className="input" name="password" placeholder="Password (optional)" />
              <label className="muted">Expires (optional)
                <input className="input" style={{ marginTop: 4 }} name="expires" type="date" />
              </label>
              <label className="muted">Images or PDF. Proofs are previews, not final artwork: JPG, PNG, WebP or GIF up to 10 MB each, PDF up to 30 MB and 60 pages, 40 MB per upload
                <FilePicker />
              </label>
              {error && <p style={{ color: 'var(--bad)' }}>{error}</p>}
              <SubmitButton className="btn btn-primary" pending="Uploading and creating…">Create proof</SubmitButton>
            </form>
          </Dialog>
        </div>
      </div>

      {error && <p style={{ color: 'var(--bad)', marginBottom: 16 }}>{error}</p>}

      <div className="client-grid">
        {client.projects.length === 0 && <div className="empty-state"><h2>No proofs yet</h2><p>Create the first proof for {client.name}.</p></div>}
        {client.projects.map((p) => {
          const open = p.versions.reduce((n, v) => n + v.comments.length, 0);
          const first = p.versions[0]?.images[0]?.file;
          const dot = statusDot(p.status);
          return (
            <Link key={p.id} href={`/admin/${p.id}`} className="client-card">
              <div className="cc-thumb">{first ? <img src={thumb(first)} alt="" loading="lazy" /> : <span className="cc-mono">{p.title.charAt(0)}</span>}</div>
              <div className="cc-body">
                <div className="cc-row">
                  <span className="cc-name">{p.title}</span>
                  {open > 0 && <span className="chip chip-needs" title="Open client comments">{open} request{open === 1 ? '' : 's'}</span>}
                </div>
                <div className="cc-row">
                  <span className="cc-dots"><span className={`kb ${dot.cls}`} title={p.status}>{dot.letter}</span><span className="ago">{p.status} · v{p.versions[0]?.number}</span></span>
                  <span className="ago">{timeAgo(p.createdAt)}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <h2 className="section-title">Activity</h2>
      <div className="req-list">
        {!activity.length && <p className="muted">Nothing yet. Activity shows up here as proofs are created, revisions are sent and versions are approved.</p>}
        {activity.map((a, i) => (
          <Link key={i} href={`/admin/${a.projectId}`} className="act">
            <span className={`act-dot act-${a.kind}`} />
            <div><div>{a.text}</div><div className="req-meta">{a.projectTitle}</div></div>
            <span className="ago">{timeAgo(a.at)}</span>
          </Link>
        ))}
      </div>

      <form action={deleteClient} style={{ marginTop: 48, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
        <input type="hidden" name="id" value={client.id} />
        <button className="btn-ghost" style={{ color: 'var(--bad)' }}>Delete client, all their proofs and comments</button>
      </form>
    </div>
  );
}
