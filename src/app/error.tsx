'use client';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto mt-32 w-full max-w-sm px-4 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-zinc-400">The page could not finish loading. If you were uploading, the files may have been too large. Keep each upload under 40 MB and try again.</p>
      <div className="mt-5 flex justify-center gap-2">
        <button className="btn" onClick={reset}>Try again</button>
        <a className="btn-ghost" href="/admin">Back to dashboard</a>
      </div>
    </main>
  );
}
