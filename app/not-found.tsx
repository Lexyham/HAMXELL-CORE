import Link from 'next/link';

export default function RootNotFound() {
  return (
    <main className="mx-auto w-full max-w-page px-[var(--gutter)] py-8">
      <p className="font-mono text-label uppercase text-brand-gold">404</p>
      <h1 className="mt-5 text-h1 font-semibold">Page not found</h1>
      <Link href="/" className="mt-6 inline-block border border-line px-4 py-3 font-mono text-label uppercase hover:border-ink">Home</Link>
    </main>
  );
}
