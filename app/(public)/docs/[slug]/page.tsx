import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import Reveal from '@/components/Reveal';
import { getProjectDocs } from '@/lib/docs';
import { renderMarkdown } from '@/lib/markdown';

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await getProjectDocs(params.slug);
  return r ? { title: `${r.project.name} documentation`, description: r.project.summary } : {};
}

const FORMATS = [['md', 'Markdown'], ['html', 'HTML'], ['pdf', 'PDF']] as const;

export default async function ProjectDocsPage({ params }: Props) {
  const r = await getProjectDocs(params.slug);
  if (!r) notFound();
  const { project, docs } = r;

  return (
    <article className="mx-auto grid w-full max-w-page gap-7 px-[var(--gutter)] pb-8 pt-7 lg:grid-cols-12">
      <div className="lg:col-span-12">
        <Link href="/docs" className="font-mono text-label uppercase text-ink-muted hover:text-ink">Documentation</Link>
        <div className="mt-5"><PageHeader eyebrow="Documentation" title={project.name} intro={project.summary || undefined} /></div>
        <Link href={`/products/${project.slug}`} className="mt-4 inline-block border-b border-brand-gold pb-1 font-mono text-label uppercase hover:text-brand-gold">Product page</Link>
      </div>

      <nav aria-label="On this page" className="lg:sticky lg:top-[5rem] lg:col-span-3 lg:self-start">
        <p className="font-mono text-label uppercase text-ink-muted">Contents</p>
        <ul className="mt-3 border-t border-line">
          {docs.map((d) => (
            <li key={d.kind} className="border-b border-line">
              <a href={`#${d.kind}`} className="block py-3 text-small hover:text-brand-gold">{d.title}</a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-8 lg:col-span-8 lg:col-start-5">
        {docs.map((d) => (
          <Reveal as="section" id={d.kind} key={d.kind} className="scroll-mt-[5rem] border-t border-line pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-label uppercase text-ink-muted">{d.title} / updated {new Date(d.updatedAt).toLocaleDateString('en-GB')}</p>
              <p className="flex gap-4 font-mono text-label uppercase">
                {FORMATS.map(([f, label]) => (
                  <a key={f} href={`/docs/${project.slug}/export/${d.kind}?format=${f}`} className="text-ink-muted hover:text-brand-gold" download>{label}</a>
                ))}
              </p>
            </div>
            <div className="doc mt-5" dangerouslySetInnerHTML={{ __html: renderMarkdown(d.md) }} />
          </Reveal>
        ))}
      </div>
    </article>
  );
}
