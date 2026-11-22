import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import Reveal from '@/components/Reveal';

export default function PublicNotFound() {
  return (
    <section className="mx-auto w-full max-w-page px-[var(--gutter)] pb-8 pt-8">
      <PageHeader eyebrow="404" title="Page not found" intro="The page you asked for does not exist, or is not public." />
      <Reveal delay={0.3} className="mt-6 flex flex-wrap gap-4 font-mono text-label uppercase">
        <Link href="/" className="border border-line px-4 py-3 hover:border-ink">Home</Link>
        <Link href="/products" className="border border-line px-4 py-3 hover:border-ink">Products</Link>
        <Link href="/contact" className="border border-line px-4 py-3 hover:border-ink">Contact</Link>
      </Reveal>
    </section>
  );
}
