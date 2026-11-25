import Link from 'next/link';
import ClosingFrame from '@/components/ClosingFrame';
import Magnetic from '@/components/Magnetic';
import ProductDirectory from '@/components/ProductDirectory';
import Reveal from '@/components/Reveal';
import RotatingWords from '@/components/RotatingWords';
import { PROCESS, ROLES, SERVICES, SKILLS, SOCIAL, STACK } from '@/content/site';
import { listPublic } from '@/lib/projects';
import { SITE } from '@/lib/site';

const GLANCE = [
  { label: 'Focus areas', value: '03', detail: 'Web and apps, systems and CRM, AI and automation' },
  { label: 'Lifecycle states', value: '06', detail: 'From in development through to discontinued' },
  { label: 'Documentation', value: 'Public', detail: 'Published documentation for every public product' },
  { label: 'Licensing', value: 'Per project', detail: 'Terms published alongside each product' },
];
const STAIR = ['', 'lg:ml-[14%]', 'lg:ml-[28%]'];
const btn = 'inline-flex min-h-[44px] items-center border px-5 py-3 text-small font-medium transition-colors duration-200 ease-out';
const chip = 'border border-line px-3 py-2 font-mono text-small text-ink-muted transition-colors duration-200 hover:border-brand-blue hover:text-ink';

export default async function HomePage() {
  const featured = await listPublic({ limit: 4, category: 'product' });

  return (
    <>
      <section aria-labelledby="hero-h" className="relative border-b border-line">
        <div className="relative z-10 mx-auto grid w-full max-w-page gap-7 px-[var(--gutter)] pb-8 pt-7 lg:grid-cols-12">
          <div className="lg:col-span-10">
            <Reveal as="p" waitForIntro scroll={false} y={16} className="font-mono text-label uppercase text-brand-gold">{SITE.name} / Technology laboratory</Reveal>
            <h1 id="hero-h" className="mt-5 text-hero font-semibold">
              <Reveal as="span" waitForIntro scroll={false} delay={0.1} y={40} className="block text-ink-muted">One ecosystem.</Reveal>
              <Reveal as="span" waitForIntro scroll={false} delay={0.22} y={40} className="block text-ink-muted">Multiple products.</Reveal>
              <Reveal as="span" waitForIntro scroll={false} delay={0.34} y={40} className="block">One identity.</Reveal>
            </h1>
            <Reveal as="p" waitForIntro scroll={false} delay={0.5} className="mt-6 max-w-[54ch] text-body text-ink-muted">{SITE.description}</Reveal>
            <Reveal as="p" waitForIntro scroll={false} delay={0.56} className="mt-4 text-h2 text-ink-muted">We build <RotatingWords words={ROLES} className="text-brand-gold" />.</Reveal>
            <Reveal waitForIntro scroll={false} delay={0.66} className="mt-6 flex flex-wrap items-center gap-3">
              <Magnetic as="span" className="inline-block"><Link href="/products" className={`${btn} border-brand-blue bg-brand-blue text-ink hover:bg-transparent`}>View products</Link></Magnetic>
              <Magnetic as="span" className="inline-block"><Link href="/contact" className={`${btn} border-line text-ink hover:border-ink`}>Contact</Link></Magnetic>
              {SOCIAL.map((s) => <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" className="ml-2 border-b border-brand-gold pb-1 font-mono text-label uppercase hover:text-brand-gold">{s.label}</a>)}
            </Reveal>
          </div>
        </div>
      </section>

      <section aria-labelledby="glance-h" className="border-b border-line">
        <div className="mx-auto grid w-full max-w-page gap-5 px-[var(--gutter)] py-7 lg:grid-cols-12">
          <Reveal as="h2" className="font-mono text-label uppercase text-ink-muted lg:col-span-3"><span id="glance-h">At a glance</span></Reveal>
          <Reveal stagger className="lg:col-span-8 lg:col-start-5">
            <dl className="divide-y divide-line border-y border-line">
              {GLANCE.map((s) => (
                <div key={s.label} className="grid gap-2 py-4 sm:grid-cols-[9rem_1fr] sm:items-baseline sm:gap-5">
                  <dt className="font-mono text-label uppercase text-ink-muted">{s.label}</dt>
                  <dd className="flex flex-wrap items-baseline gap-x-4 gap-y-1"><span className="font-mono text-h2 font-semibold">{s.value}</span><span className="text-small text-ink-muted">{s.detail}</span></dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="services-h" className="border-b border-line">
        <div className="mx-auto grid w-full max-w-page gap-6 px-[var(--gutter)] py-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Reveal as="h2" className="text-h1 font-semibold"><span id="services-h">What we build</span></Reveal>
            <Reveal as="p" delay={0.1} className="mt-4 max-w-[36ch] text-body text-ink-muted">Three areas of work, one standard of engineering.</Reveal>
          </div>
          <Reveal as="ol" stagger className="lg:col-span-7 lg:col-start-6">
            {SERVICES.map((s, i) => (
              <li key={s.title} className="grid gap-3 border-t border-line py-6 sm:grid-cols-[3.5rem_1fr]">
                <span className="font-mono text-small text-brand-gold">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="text-h2 font-semibold">{s.title}</h3>
                  <p className="mt-2 max-w-[56ch] text-body text-ink-muted">{s.text}</p>
                  <ul className="mt-4 space-y-1 text-small text-ink-muted">{s.points.map((p) => <li key={p} className="flex gap-3"><span aria-hidden className="mt-[0.6em] h-[1px] w-[0.75rem] shrink-0 bg-brand-blue" />{p}</li>)}</ul>
                </div>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="process-h" className="border-b border-line">
        <div className="mx-auto w-full max-w-page px-[var(--gutter)] py-8">
          <Reveal as="h2" className="max-w-[18ch] text-h1 font-semibold"><span id="process-h">More than websites.</span></Reveal>
          <Reveal as="p" delay={0.1} className="mt-4 max-w-[58ch] text-body text-ink-muted">A page is only the visible part. Behind it sit the data, workflows and integrations that decide whether a product actually works.</Reveal>
          <Reveal as="ol" stagger className="mt-7 grid gap-6">
            {PROCESS.map((p, i) => (
              <li key={p.title} className={`flex max-w-[44rem] gap-5 border-t border-line pt-5 ${STAIR[i] ?? ''}`}>
                <span className="shrink-0 whitespace-nowrap font-mono text-h1 font-semibold text-brand-blue">{String(i + 1).padStart(2, '0')}</span>
                <div><h3 className="text-h2 font-semibold">{p.title}</h3><p className="mt-2 text-small text-ink-muted">{p.text}</p></div>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="products-h" className="border-b border-line">
        <div className="mx-auto w-full max-w-page px-[var(--gutter)] py-8">
          <div className="grid gap-4 lg:grid-cols-12 lg:items-end">
            <Reveal as="h2" className="text-h1 font-semibold lg:col-span-6"><span id="products-h">Featured products</span></Reveal>
            <Reveal as="p" delay={0.1} className="text-body text-ink-muted lg:col-span-4 lg:col-start-9">A selection from the public directory. Each product has its own page, documentation and licence.</Reveal>
          </div>
          <div className="mt-7"><ProductDirectory products={featured} /></div>
          <Reveal className="mt-7"><Link href="/products" className="inline-block border-b border-brand-gold pb-1 font-mono text-label uppercase text-ink transition-colors hover:text-brand-gold">Full directory</Link></Reveal>
        </div>
      </section>

      <section aria-labelledby="skills-h" className="border-b border-line">
        <div className="mx-auto grid w-full max-w-page gap-7 px-[var(--gutter)] py-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Reveal as="h2" className="font-mono text-label uppercase text-ink-muted"><span id="skills-h">Skills</span></Reveal>
            <Reveal as="ul" stagger className="mt-4 flex flex-wrap gap-2">{SKILLS.map((s) => <li key={s} className={chip}>{s}</li>)}</Reveal>
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <Reveal as="h2" className="font-mono text-label uppercase text-ink-muted">Stack</Reveal>
            <Reveal as="ul" stagger className="mt-4 flex flex-wrap gap-2">{STACK.map((s) => <li key={s} className={chip}>{s}</li>)}</Reveal>
          </div>
        </div>
      </section>

      <ClosingFrame />
    </>
  );
}
