'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { gsap, prefersReducedMotion } from '@/lib/gsap';
import { useIntro } from './IntroProvider';

type Tag = 'div' | 'span' | 'p' | 'header' | 'section' | 'footer' | 'ul' | 'ol' | 'dl' | 'h1' | 'h2' | 'h3' | 'article' | 'aside' | 'nav' | 'li';

interface Props {
  as?: Tag;
  id?: string;
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  /** Animate the direct children one after another instead of the element itself. */
  stagger?: boolean;
  /** Hold the animation until the intro has finished. */
  waitForIntro?: boolean;
  /** Trigger on scroll into view (default). When false it plays immediately. */
  scroll?: boolean;
}

/** Fade + slide-up on entry. Hidden state lives in CSS ([data-reveal]) so there is no flash before JS runs. */
export default function Reveal({
  as = 'div',
  id,
  children,
  className,
  delay = 0,
  y = 28,
  stagger = false,
  waitForIntro = false,
  scroll = true,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { introDone } = useIntro();
  const ready = !waitForIntro || introDone;
  const Tag = as as 'div';

  useEffect(() => {
    const el = ref.current;
    if (!el || !ready || prefersReducedMotion()) return;
    const targets = stagger ? Array.from(el.children) : el;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { y, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.9,
          ease: 'power3.out',
          delay,
          stagger: stagger ? 0.12 : 0,
          clearProps: 'transform',
          scrollTrigger: scroll ? { trigger: el, start: 'top 88%', once: true } : undefined,
        },
      );
    }, el);
    return () => ctx.revert();
  }, [ready, stagger, y, delay, scroll]);

  const attr = stagger ? { 'data-reveal-stagger': '' } : { 'data-reveal': '' };
  return (
    <Tag ref={ref} id={id} className={className} {...attr}>
      {children}
    </Tag>
  );
}
