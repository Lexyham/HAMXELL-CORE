import type { ReactNode } from 'react';
import Reveal from './Reveal';

/** Consistent animated page opening: eyebrow, title and optional introduction. */
export default function PageHeader({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro?: string; children?: ReactNode }) {
  return (
    <header>
      <Reveal as="p" scroll={false} y={14} className="font-mono text-label uppercase text-brand-gold">{eyebrow}</Reveal>
      <Reveal as="h1" scroll={false} delay={0.08} y={28} className="mt-5 text-h1 font-semibold">{title}</Reveal>
      {intro && <Reveal as="p" scroll={false} delay={0.18} className="mt-4 max-w-[54ch] text-body text-ink-muted">{intro}</Reveal>}
      {children}
    </header>
  );
}
