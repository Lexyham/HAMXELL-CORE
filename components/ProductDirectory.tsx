import Link from 'next/link';
import { Product, STATUS_LABEL, type ProjectStatus } from '@/lib/products';
import Magnetic from './Magnetic';
import Reveal from './Reveal';

const DOT: Record<ProjectStatus, string> = {
  active: 'bg-success',
  in_development: 'bg-brand-blue',
  experimental: 'bg-warning',
  paused: 'bg-ink-muted',
  archived: 'bg-ink-muted',
  discontinued: 'bg-danger',
};

/** Staggered two-column directory (desktop) that collapses to one column on mobile. Never a 3-column grid. */
export default function ProductDirectory({ products, emptyText = 'No public products have been published yet.' }: { products: Product[]; emptyText?: string }) {
  if (products.length === 0) {
    return <p className="border border-line p-5 text-small text-ink-muted">{emptyText}</p>;
  }
  return (
    <Reveal as="ul" stagger className="grid gap-5 md:grid-cols-2 md:gap-x-6">
      {products.map((p, i) => (
        <li key={p.slug} className="md:even:mt-7">
          <Magnetic strength={0.03} className="h-full">
            <article className="group relative flex h-full flex-col border border-line bg-bg-secondary p-5 transition-colors duration-200 ease-out hover:border-brand-blue">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-label uppercase text-ink-muted">{String(i + 1).padStart(2, '0')}</span>
                <span className="flex items-center gap-2 font-mono text-label uppercase text-ink-muted">
                  <span aria-hidden className={`h-[6px] w-[6px] ${DOT[p.status]}`} />
                  {STATUS_LABEL[p.status]}
                </span>
              </div>
              <h3 className="mt-6 text-h2 font-semibold">
                <Link href={`/products/${p.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
                  {p.name}
                </Link>
              </h3>
              <p className="mt-3 max-w-[46ch] text-small text-ink-muted">{p.summary}</p>
              <ul className="mt-6 flex flex-wrap gap-2">
                {p.tags.map((t) => (
                  <li key={t} className="border border-line px-2 py-1 font-mono text-label uppercase text-ink-muted">
                    {t}
                  </li>
                ))}
                {p.placeholder && (
                  <li className="border border-line px-2 py-1 font-mono text-label uppercase text-brand-gold">Placeholder</li>
                )}
              </ul>
            </article>
          </Magnetic>
        </li>
      ))}
    </Reveal>
  );
}
