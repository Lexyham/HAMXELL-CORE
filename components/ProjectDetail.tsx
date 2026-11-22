import Link from 'next/link';
import { flag } from '@/lib/flags';
import Magnetic from './Magnetic';
import Reveal from './Reveal';
import { Product, STATUS_LABEL, VISIBILITY_LABEL } from '@/lib/products';

export function Paragraphs({ text }: { text?: string }) {
  const parts = (text ?? '').split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  return (
    <>
      {parts.map((t, i) => (
        <p key={i} className="mt-4 max-w-[62ch] text-body text-ink-muted">{t}</p>
      ))}
    </>
  );
}

export function LicenceBlock({ p }: { p: Pick<Product, 'licenceType' | 'licenceUrl'> }) {
  if (!flag('FEATURE_LICENSING') || !p.licenceType) return null;
  return (
    <div>
      <dt className="font-mono text-label uppercase text-ink-muted">Licence</dt>
      <dd className="mt-1 text-small">
        {p.licenceUrl ? (
          <a href={p.licenceUrl} target="_blank" rel="noopener noreferrer" className="border-b border-brand-gold">{p.licenceType}</a>
        ) : (
          p.licenceType
        )}
      </dd>
    </div>
  );
}

export default function ProjectDetail({ p }: { p: Product }) {
  return (
    <article className="mx-auto grid w-full max-w-page gap-7 px-[var(--gutter)] pb-8 pt-7 lg:grid-cols-12">
      <Reveal scroll={false} className="lg:col-span-8">
        <Link href="/products" className="font-mono text-label uppercase text-ink-muted hover:text-ink">Products</Link>
        <h1 className="mt-5 text-h1 font-semibold">{p.name}</h1>
        <p className="mt-4 max-w-[54ch] text-body text-ink">{p.summary}</p>
        <Paragraphs text={p.description} />
        {p.launchUrl && (
          <Magnetic as="span" className="mt-6 inline-block"><a href={p.launchUrl} target="_blank" rel="noopener noreferrer" className="inline-flex border border-brand-blue bg-brand-blue px-5 py-3 text-small font-medium hover:bg-transparent">Launch project</a></Magnetic>
        )}
      </Reveal>
      <dl className="grid gap-4 self-start border-t border-line pt-5 lg:col-span-3 lg:col-start-10">
        <div>
          <dt className="font-mono text-label uppercase text-ink-muted">Status</dt>
          <dd className="mt-1 text-small">{STATUS_LABEL[p.status]}</dd>
        </div>
        <div>
          <dt className="font-mono text-label uppercase text-ink-muted">Access</dt>
          <dd className="mt-1 text-small">{VISIBILITY_LABEL[p.visibility]}</dd>
        </div>
        {p.tags.length > 0 && (
          <div>
            <dt className="font-mono text-label uppercase text-ink-muted">Technology</dt>
            <dd className="mt-1 font-mono text-small">{p.tags.join(', ')}</dd>
          </div>
        )}
        <LicenceBlock p={p} />
      </dl>
    </article>
  );
}
