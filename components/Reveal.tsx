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
  const awaitingIntro = waitForIntro && !introDone;
  const ready = !awaitingIntro;
  const Tag = as as 'div';

  useEffect(() => {
    const el = ref.current;
    if (!el || !ready || prefersReducedMotion()) return;
    const fallback = window.setTimeout(() => {
      if (stagger) Array.from(el.children).forEach((child) => {
        (child as HTMLElement).style.opacity = '1';
        (child as HTMLElement).style.transform = 'none';
      });
      else { el.style.opacity = '1'; el.style.transform = 'none'; }
    }, 3000);
    const targets = stagger ? Array.from(el.children) : el;
    let ctx: ReturnType<typeof gsap.context> | undefined;
    try {
      ctx = gsap.context(() => {
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
    } catch (error) {
      console.error('Reveal animation failed to initialize', error);
      if (stagger) Array.from(el.children).forEach((child) => {
        (child as HTMLElement).style.opacity = '1';
        (child as HTMLElement).style.transform = 'none';
      });
      else { el.style.opacity = '1'; el.style.transform = 'none'; }
      window.clearTimeout(fallback);
    }
    return () => { window.clearTimeout(fallback); ctx?.revert(); };
  }, [ready, stagger, y, delay, scroll]);

  const attr = stagger ? { 'data-reveal-stagger': '' } : { 'data-reveal': '' };
  return (
    <Tag ref={ref} id={id} className={className} {...attr} data-intro-ready={awaitingIntro ? '' : undefined}>
      {children}
    </Tag>
  );
}
