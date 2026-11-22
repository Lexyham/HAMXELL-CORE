import type { Metadata } from 'next';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { Paragraphs } from '@/components/ProjectDetail';
import Reveal from '@/components/Reveal';
import { flag } from '@/lib/flags';
import { listPublic } from '@/lib/projects';

export const metadata: Metadata = { title: 'Licences' };

export default async function LicensesPage() {
  if (!flag('FEATURE_LICENSING')) {
    return (
      <section className="mx-auto w-full max-w-page px-[var(--gutter)] pb-8 pt-7">
        <PageHeader eyebrow="Licences" title="Licences and usage terms" intro="Coming soon." />
      </section>
    );
  }
  const items = (await listPublic()).filter((p) => !p.placeholder && p.licenceType);
  return (
    <section className="mx-auto w-full max-w-page px-[var(--gutter)] pb-8 pt-7">
      <PageHeader eyebrow="Licences" title="Licences and usage terms" intro="Each public project states the terms under which it may be used." />
      <Reveal as="ul" stagger className="mt-7 divide-y divide-line border-y border-line lg:ml-[25%]">
        {items.map((p) => (
          <li key={p.slug} className="py-5">
            <Link href={`/products/${p.slug}`} className="text-h2 font-semibold hover:text-brand-gold">{p.name}</Link>
            <p className="mt-1 font-mono text-small text-ink-muted">
              {p.licenceUrl ? <a href={p.licenceUrl} target="_blank" rel="noopener noreferrer" className="border-b border-brand-gold">{p.licenceType}</a> : p.licenceType}
            </p>
            <Paragraphs text={p.licenceText ?? ''} />
          </li>
        ))}
        {items.length === 0 && <li className="py-5 text-small text-ink-muted">No licence terms have been published yet.</li>}
      </Reveal>
    </section>
  );
}
