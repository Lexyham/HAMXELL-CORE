import type { Metadata } from 'next';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import Reveal from '@/components/Reveal';
import { listDocProjects } from '@/lib/docs';

export const metadata: Metadata = { title: 'Documentation' };

export default async function DocsIndex() {
  const projects = await listDocProjects();
  return (
    <section className="mx-auto w-full max-w-page px-[var(--gutter)] pb-8 pt-7">
      <PageHeader eyebrow="Documentation" title="Documentation index" intro="Published documentation for public products." />
      <Reveal as="ul" stagger className="mt-7 divide-y divide-line border-y border-line lg:ml-[25%]">
        {projects.map((p) => (
          <li key={p.slug}>
            <Link href={`/docs/${p.slug}`} className="grid gap-1 py-5 transition-colors hover:bg-bg-secondary sm:grid-cols-[1fr_auto] sm:gap-6">
              <span>
                <span className="block text-h2 font-semibold">{p.name}</span>
                {p.summary && <span className="mt-1 block max-w-[54ch] text-small text-ink-muted">{p.summary}</span>}
              </span>
              <span className="font-mono text-label uppercase text-ink-muted">{p.count} {p.count === 1 ? 'document' : 'documents'}</span>
            </Link>
          </li>
        ))}
        {projects.length === 0 && <li className="py-5 text-small text-ink-muted">No documentation has been published yet.</li>}
      </Reveal>
    </section>
  );
}
