import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { createClient, logout } from './actions';

export const dynamic = 'force-dynamic';

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { error } = await searchParams;
  const clients = await db.client.findMany({
    orderBy: { name: 'asc' },
    include: { projects: { include: { versions: { include: { comments: { where: { parentId: null, resolved: false, fromDesigner: false } } } } } } },
  });
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Reyal Proof</h1>
        <form action={logout}><button className="btn-ghost">Sign out</button></form>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium text-zinc-400">Clients</h2>
        <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {clients.length === 0 && <p className="p-5 text-sm text-zinc-500">No clients yet. Add the first one below.</p>}
          {clients.map((c) => {
            const open = c.projects.reduce((n, p) => n + p.versions.reduce((m, v) => m + v.comments.length, 0), 0);
            return (
              <Link key={c.id} href={`/admin/clients/${c.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-zinc-900">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-sm text-zinc-500">{c.projects.length} proof{c.projects.length === 1 ? '' : 's'}{c.email && ` · ${c.email}`}</div>
                </div>
                {open > 0 && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-sm text-amber-300">{open} open</span>}
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-400">New client</h2>
        <form action={createClient} className="card grid gap-3 sm:grid-cols-2">
          <input className="input" name="name" placeholder="Client name" required />
          <input className="input" name="email" type="email" placeholder="Contact email (optional)" />
          <input className="input sm:col-span-2" name="notes" placeholder="Notes (optional)" />
          {error && <p className="text-sm text-red-400 sm:col-span-2">{error}</p>}
          <button className="btn sm:col-span-2">Add client</button>
        </form>
      </section>
    </main>
  );
}
