'use client';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-page px-[var(--gutter)] py-8">
      <p className="font-mono text-label uppercase text-danger">Error</p>
      <h1 className="mt-5 text-h1 font-semibold">Something went wrong</h1>
      <p className="mt-4 max-w-[48ch] text-body text-ink-muted">The page could not be shown. You can try again, or return to the homepage.</p>
      {error.digest && <p className="mt-3 font-mono text-small text-ink-muted">Reference: {error.digest}</p>}
      <div className="mt-6 flex flex-wrap gap-4 font-mono text-label uppercase">
        <button type="button" onClick={reset} className="border border-brand-blue bg-brand-blue px-4 py-3 hover:bg-transparent">Try again</button>
        <a href="/" className="border border-line px-4 py-3 hover:border-ink">Home</a>
      </div>
    </main>
  );
}
