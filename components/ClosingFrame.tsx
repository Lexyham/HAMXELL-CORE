'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { SOCIAL } from '@/content/site';
import { gsap, prefersReducedMotion, ScrollTrigger } from '@/lib/gsap';
import Magnetic from './Magnetic';
import Reveal from './Reveal';

const LINES = ['One ecosystem.', 'Multiple products.', 'One identity.'];

/** The closing frame: the three lines of the tagline slide against each other as you scroll through, then the call to action. */
export default function ClosingFrame() {
  const root = useRef<HTMLElement>(null);
  const lines = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (prefersReducedMotion() || !root.current) return;
    const ctx = gsap.context(() => {
      lines.current.forEach((el, i) => {
        if (!el) return;
        const dir = i % 2 === 0 ? 1 : -1;
        gsap.fromTo(el, { xPercent: dir * 14 }, { xPercent: -dir * 14, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom top', scrub: true } });
      });
    }, root);
    return () => { ctx.revert(); ScrollTrigger.refresh(); };
  }, []);

  return (
    <section ref={root} aria-labelledby="closing-h" className="overflow-hidden border-t border-line">
      <div className="mx-auto w-full max-w-page px-[var(--gutter)] pb-6 pt-8">
        <p className="font-mono text-label uppercase text-ink-muted">Closing frame</p>
      </div>
      <h2 id="closing-h" className="select-none text-hero font-semibold leading-[1.02]">
        {LINES.map((l, i) => (
          <span key={l} ref={(el) => { lines.current[i] = el; }} className={`block whitespace-nowrap px-[var(--gutter)] ${i === 2 ? 'text-ink' : 'text-ink-muted'}`}>{l}</span>
        ))}
      </h2>
      <div className="mx-auto grid w-full max-w-page gap-5 px-[var(--gutter)] pb-8 pt-7 lg:grid-cols-12">
        <Reveal className="lg:col-span-5">
          <p className="text-h2 font-semibold">Have a system to build or a product to evaluate?</p>
        </Reveal>
        <Reveal delay={0.1} className="lg:col-span-4 lg:col-start-8">
          <p className="text-body text-ink-muted">Send an enquiry and it will be read and answered directly.</p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Magnetic as="span" className="inline-block">
              <Link href="/contact" className="inline-flex min-h-[44px] items-center border border-brand-gold px-5 py-3 text-small font-medium transition-colors duration-200 ease-out hover:bg-brand-gold hover:text-bg">Start an enquiry</Link>
            </Magnetic>
            {SOCIAL.map((s) => <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" className="border-b border-brand-gold pb-1 font-mono text-label uppercase hover:text-brand-gold">{s.label}</a>)}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
