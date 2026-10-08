import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import CardShell from './CardShell';
import FilePicker from '@/components/FilePicker';
import SubmitButton from '@/components/SubmitButton';
import PinCrop from './PinCrop';
import ProofViewer from './ProofViewer';
import { addVersion, deleteProject, reopenApproval, replyTo, setResolved, updateProject } from '../actions';

export const dynamic = 'force-dynamic';
const STATUSES = ['Draft', 'Sent', 'Feedback Received', 'Approved'];
const when = (d: Date) => d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { error } = await searchParams;
  const p = await db.project.findUnique({
    where: { id },
    include: {
      client: true,
      versions: {
        orderBy: { number: 'desc' },
        include: { images: { orderBy: { position: 'asc' } }, comments: { orderBy: { createdAt: 'asc' } } },
      },
    },
  });
  if (!p) notFound();
  const h = await headers();
  const base = process.env.APP_URL || `${h.get('x-forwarded-proto') || 'http'}://${h.get('host')}`;
  const link = `${base}/review/${p.slug}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Link href={`/admin/clients/${p.clientId}`} className="text-sm text-zinc-400 hover:text-white">← {p.client.name}</Link>
      <h1 className="mb-1 mt-3 text-xl font-semibold">{p.title}</h1>
      <p className="mb-6 text-sm text-zinc-500">{p.client.name}</p>

      {p.approvedAt && (
        <section className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-600/50 bg-emerald-950/40 p-4">
          <div>
            <div className="font-medium text-emerald-300">Approved by {p.approvedBy} · version {p.approvedVersion}</div>
            <div className="text-sm text-emerald-200/70">{when(p.approvedAt)} · Terms accepted. The client can no longer comment on this version.</div>
          </div>
          <form action={reopenApproval}>
            <input type="hidden" name="id" value={p.id} />
            <button className="btn-ghost">Reopen for changes</button>
          </form>
        </section>
      )}

      <section className="card mb-8 space-y-4">
        <div>
          <div className="mb-1 text-sm text-zinc-400">Share link</div>
          <div className="flex gap-2">
            <input className="input" readOnly value={link} />
            <a className="btn-ghost" href={link} target="_blank">Open</a>
          </div>
        </div>
        <form action={updateProject} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={p.id} />
          <input className="input" name="title" defaultValue={p.title} required />
          <select className="input" name="status" defaultValue={p.status}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <input className="input" name="password" defaultValue={p.password ?? ''} placeholder="Password (optional)" />
          <label className="text-sm text-zinc-400">Expires
            <input className="input mt-1" name="expires" type="date" defaultValue={p.expiresAt?.toISOString().slice(0, 10)} />
          </label>
          <div className="flex items-end"><button className="btn">Save settings</button></div>
        </form>
      </section>

      <section className="card mb-8">
        <h2 className="mb-3 text-sm font-medium text-zinc-400">Upload a new version</h2>
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        <form action={addVersion} className="flex flex-wrap gap-3">
          <input type="hidden" name="projectId" value={p.id} />
          <input className="input max-w-xs" name="label" placeholder="Label (e.g. changes #41)" />
          <div className="max-w-xs"><FilePicker className="input" /></div>
          <SubmitButton pending="Uploading…">Upload version</SubmitButton>
        </form>
      </section>

      {p.versions.map((v) => {
        const roots = v.comments.filter((c) => !c.parentId);
        const pins = roots.filter((c) => c.x != null && c.imageId).map((c) => ({ id: c.id, imageId: c.imageId, x: c.x!, y: c.y!, pin: c.pin, resolved: c.resolved, text: c.text }));
        return (
          <section key={v.id} className="mb-10">
            <h2 className="mb-3 font-medium">v{v.number} · {v.label} <span className="text-sm text-zinc-500">· {when(v.createdAt)} · {v.images.length} page{v.images.length === 1 ? '' : 's'}</span></h2>
            {roots.length === 0 && <p className="text-sm text-zinc-500">No comments on this version.</p>}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
              <div className="lg:sticky lg:top-4 lg:self-start">
                <ProofViewer versionId={v.id} images={v.images.map((i) => ({ id: i.id, file: i.file }))} pins={pins} />
              </div>
              <div className="space-y-3">
                {roots.map((c) => {
                  const page = v.images.findIndex((i) => i.id === c.imageId);
                  const img = v.images[page];
                  return (
                    <CardShell key={c.id} versionId={v.id} commentId={c.id} imageId={img && c.x != null ? c.imageId : null} resolved={c.resolved}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="mr-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-semibold text-white">{c.pin ?? '•'}</span>
                          <span className="text-sm font-medium">{c.author}</span>
                          <span className="ml-2 text-xs text-zinc-500">{when(c.createdAt)}</span>
                          <div className="mt-1 text-xs text-amber-300">
                            {img && c.x != null
                              ? `Page ${page + 1} of ${v.images.length} · ${c.x.toFixed(0)}% from left, ${c.y!.toFixed(0)}% from top · click to show on page`
                              : 'General comment (not placed on the design)'}
                          </div>
                          {img && c.x != null && <div className="mt-2"><PinCrop src={`/files/${img.file}`} x={c.x} y={c.y!} pin={c.pin} /></div>}
                          <p className="mt-2 whitespace-pre-wrap text-sm">{c.text}</p>
                        </div>
                        <form action={setResolved}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="resolved" value={c.resolved ? '0' : '1'} />
                          <button className="btn-ghost whitespace-nowrap">{c.resolved ? 'Reopen' : 'Resolve'}</button>
                        </form>
                      </div>
                      {v.comments.filter((r) => r.parentId === c.id).map((r) => (
                        <p key={r.id} className="mt-3 border-l-2 border-zinc-700 pl-3 text-sm text-zinc-300"><b>{r.author}:</b> {r.text}</p>
                      ))}
                      <form action={replyTo} className="mt-3 flex gap-2">
                        <input type="hidden" name="id" value={c.id} />
                        <input className="input" name="text" placeholder="Reply (client sees it on their next visit)" />
                        <button className="btn-ghost">Reply</button>
                      </form>
                    </CardShell>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}

      <form action={deleteProject} className="mt-12 border-t border-zinc-800 pt-6">
        <input type="hidden" name="id" value={p.id} />
        <button className="text-sm text-red-400 hover:text-red-300">Delete project and all comments</button>
      </form>
    </main>
  );
}
