import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { createProject, logout } from './actions';

export const dynamic = 'force-dynamic';

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { error } = await searchParams;
  const projects = await db.project.findMany({
    orderBy: { createdAt: 'desc' },
    include: { versions: { include: { comments: { where: { parentId: null, resolved: false, fromDesigner: false } } } } },
  });
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Reyal Proof</h1>
        <form action={logout}><button className="btn-ghost">Sign out</button></form>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium text-zinc-400">Projects</h2>
        <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {projects.length === 0 && <p className="p-5 text-sm text-zinc-500">No projects yet. Create the first one below.</p>}
          {projects.map((p) => {
            const open = p.versions.reduce((n, v) => n + v.comments.length, 0);
            return (
              <Link key={p.id} href={`/admin/${p.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-zinc-900">
                <div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-sm text-zinc-500">{p.client || 'No client'} · {p.versions.length} version{p.versions.length === 1 ? '' : 's'}</div>
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
        <h2 className="mb-3 text-sm font-medium text-zinc-400">New proof</h2>
        <form action={createProject} className="card grid gap-3 sm:grid-cols-2">
          <input className="input" name="title" placeholder="Title (e.g. Menu - Main)" required />
          <input className="input" name="client" placeholder="Client name" />
          <input className="input" name="label" placeholder='Version label (e.g. "changes #40")' />
          <input className="input" name="password" placeholder="Password (optional)" />
          <label className="text-sm text-zinc-400">Expires (optional)
            <input className="input mt-1" name="expires" type="date" />
          </label>
          <label className="text-sm text-zinc-400">Images (JPG, PNG, WebP, GIF, up to 25 MB each)
            <input className="input mt-1" name="files" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple required />
          </label>
          {error && <p className="text-sm text-red-400 sm:col-span-2">{error}</p>}
          <button className="btn sm:col-span-2">Create proof</button>
        </form>
      </section>
    </main>
  );
}
