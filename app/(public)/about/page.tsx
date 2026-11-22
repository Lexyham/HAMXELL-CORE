import type { Metadata } from 'next';
import Link from 'next/link';
import Magnetic from '@/components/Magnetic';
import PageHeader from '@/components/PageHeader';
import Reveal from '@/components/Reveal';
import { ABOUT } from '@/content/about';

export const metadata: Metadata = { title: 'About' };

export default function AboutPage() {
  const { identity, founder, cv } = ABOUT;
  const hasFounder = founder.name.trim() !== '';
  return (
    <section className="mx-auto grid w-full max-w-page gap-7 px-[var(--gutter)] pb-8 pt-7 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <PageHeader eyebrow="About" title="One ecosystem. Multiple products. One identity." />
        <Reveal stagger className="mt-5">{identity.map((p) => <p key={p} className="mt-5 max-w-[60ch] text-body text-ink-muted first:mt-0">{p}</p>)}</Reveal>
      </div>

      <Reveal stagger className="grid content-start gap-7 lg:col-span-4 lg:col-start-9">
        {hasFounder ? (
          <section aria-labelledby="founder-h" className="border-t border-line pt-5">
            <h2 id="founder-h" className="font-mono text-label uppercase text-ink-muted">Founder</h2>
            <p className="mt-3 text-h2 font-semibold">{founder.name}</p>
            {founder.role && <p className="text-small text-ink-muted">{founder.role}</p>}
            {founder.bio.map((p) => <p key={p} className="mt-3 text-small text-ink-muted">{p}</p>)}
            {cv.path && <a href={cv.path} download className="mt-4 inline-block border-b border-brand-gold pb-1 font-mono text-label uppercase hover:text-brand-gold">{cv.label}</a>}
          </section>
        ) : <span aria-hidden className="hidden" />}
        <section aria-labelledby="hire-h" className="border-t border-line pt-5">
          <h2 id="hire-h" className="font-mono text-label uppercase text-ink-muted">Work with us</h2>
          <p className="mt-3 text-small text-ink-muted">To discuss a project or an engagement, send an enquiry.</p>
          <Magnetic as="span" className="mt-4 inline-block"><Link href="/contact?topic=hire" className="inline-flex border border-brand-gold px-5 py-3 text-small font-medium transition-colors hover:bg-brand-gold hover:text-bg">Hire us</Link></Magnetic>
        </section>
      </Reveal>
    </section>
  );
}
