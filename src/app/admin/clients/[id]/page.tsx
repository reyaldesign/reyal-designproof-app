import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import FilePicker from '@/components/FilePicker';
import SubmitButton from '@/components/SubmitButton';
import { clientActivity } from '@/lib/activity';
import { db } from '@/lib/db';
import { thumb, timeAgo } from '@/lib/format';
import { PROOF_TYPES } from '@/lib/types';
import { createProject, deleteClient, deleteProject, updateClient } from '../../actions';
import ConfirmDelete from '../../ConfirmDelete';
import Dialog from '../../Dialog';
import ProofBoard, { type ProofCard } from './ProofBoard';

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
          _count: { select: { submissions: true } },
          versions: {
            orderBy: { number: 'desc' },
            include: { images: { orderBy: { position: 'asc' }, take: 1 }, comments: { where: { parentId: null, resolved: false, fromDesigner: false } } },
          },
        },
      },
    },
  });
  if (!client) notFound();
  const activity = await clientActivity(client.id, 60);
  const h = await headers();
  const base = process.env.APP_URL || `${h.get('x-forwarded-proto') || 'http'}://${h.get('host')}`;

  const proofs: ProofCard[] = client.projects.map((p) => {
    const file = p.versions[0]?.images[0]?.file;
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      type: p.type,
      status: p.status,
      version: p.versions[0]?.number ?? 1,
      open: p.versions.reduce((n, v) => n + v.comments.length, 0),
      used: p._count.submissions,
      included: p.revisionsIncluded ?? client.revisionsIncluded,
      ago: timeAgo(p.createdAt),
      thumb: file ? thumb(file) : null,
    };
  });

  return (
    <div className="page">
      <div className="crumbs"><Link href="/admin">Clients</Link> <span className="muted">/</span></div>
      <div className="page-head">
        <div>
          <h1 className="h1">{client.name}</h1>
          <p className="meta-line">
            {client.email && <span>{client.email}</span>}
            {client.notes && <span>{client.notes}</span>}
            <span className="strong">{client.revisionsIncluded} revision{client.revisionsIncluded === 1 ? '' : 's'} included per proof</span>
          </p>
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
              <p className="muted" style={{ fontSize: 12 }}>Each time this client presses Send revision, one revision is used. When they run out they can no longer send, until you raise this number. A single proof can override it in its settings.</p>
              <SubmitButton className="btn btn-primary" pending="Saving…">Save client</SubmitButton>
            </form>
            <div className="danger-zone">
              <span className="muted">Danger zone</span>
              <ConfirmDelete id={client.id} name={client.name} action={deleteClient} kind="client" />
            </div>
          </Dialog>
          <Dialog label="+ New proof" title={`New proof for ${client.name}`} defaultOpen={!!error} wide>
            <form action={createProject} style={{ display: 'grid', gap: 12 }}>
              <input type="hidden" name="clientId" value={client.id} />
              <label className="muted">Type
                <select className="input" style={{ marginTop: 4 }} name="type" required defaultValue="">
                  <option value="" disabled>Choose a type…</option>
                  {PROOF_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
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

      <ProofBoard
        proofs={proofs}
        activity={activity.map((a) => ({ kind: a.kind, text: a.text, projectId: a.projectId, projectTitle: a.projectTitle, ago: timeAgo(a.at) }))}
        base={base}
        deleteProject={deleteProject}
      />
    </div>
  );
}
