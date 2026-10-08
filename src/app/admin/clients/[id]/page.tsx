import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import FilePicker from '@/components/FilePicker';
import SubmitButton from '@/components/SubmitButton';
import { createProject, deleteClient } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { error } = await searchParams;
  const client = await db.client.findUnique({
    where: { id },
    include: {
      projects: {
        orderBy: { createdAt: 'desc' },
        include: { versions: { include: { comments: { where: { parentId: null, resolved: false, fromDesigner: false } } } } },
      },
    },
  });
  if (!client) notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/admin" className="text-sm text-zinc-400 hover:text-white">← All clients</Link>
      <h1 className="mb-1 mt-3 text-xl font-semibold">{client.name}</h1>
      <p className="mb-8 text-sm text-zinc-500">{[client.email, client.notes].filter(Boolean).join(' · ') || 'No contact details'}</p>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium text-zinc-400">Proofs</h2>
        <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {client.projects.length === 0 && <p className="p-5 text-sm text-zinc-500">No proofs for this client yet. Create one below.</p>}
          {client.projects.map((p) => {
            const open = p.versions.reduce((n, v) => n + v.comments.length, 0);
            return (
              <Link key={p.id} href={`/admin/${p.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-zinc-900">
                <div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-sm text-zinc-500">{p.versions.length} version{p.versions.length === 1 ? '' : 's'}</div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {open > 0 && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-300">{open} open</span>}
                  <span className="text-zinc-400">{p.status}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-400">New proof for {client.name}</h2>
        <form action={createProject} className="card grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="clientId" value={client.id} />
          <input className="input" name="title" placeholder="Proof title (e.g. Menu - Main)" required />
          <input className="input" name="label" placeholder='Version label (e.g. "changes #40")' />
          <input className="input" name="password" placeholder="Password (optional)" />
          <label className="text-sm text-zinc-400">Expires (optional)
            <input className="input mt-1" name="expires" type="date" />
          </label>
          <label className="text-sm text-zinc-400 sm:col-span-2">Images or PDF. Proofs are previews, not final artwork: JPG, PNG, WebP or GIF up to 10 MB each, PDF up to 30 MB and 60 pages, 40 MB per upload
            <FilePicker />
          </label>
          {error && <p className="text-sm text-red-400 sm:col-span-2">{error}</p>}
          <SubmitButton className="btn sm:col-span-2" pending="Uploading and creating…">Create proof</SubmitButton>
        </form>
      </section>

      <form action={deleteClient} className="mt-12 border-t border-zinc-800 pt-6">
        <input type="hidden" name="id" value={client.id} />
        <button className="text-sm text-red-400 hover:text-red-300">Delete client, all their proofs and comments</button>
      </form>
    </main>
  );
}
