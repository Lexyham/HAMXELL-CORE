'use client';

import Lenis from 'lenis';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { gsap, prefersReducedMotion, ScrollTrigger } from '@/lib/gsap';
import { useIntro } from './IntroProvider';

/** Lenis momentum scrolling, driven by the GSAP ticker so ScrollTrigger stays in sync. */
export default function SmoothScroll() {
  const pathname = usePathname();
  const { introDone } = useIntro();
  const lenis = useRef<Lenis | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    const l = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
    lenis.current = l;
    l.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => l.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener('load', refresh);
    return () => {
      window.removeEventListener('load', refresh);
      gsap.ticker.remove(tick);
      l.destroy();
      lenis.current = null;
    };
  }, []);

  useEffect(() => {
    if (introDone) lenis.current?.start();
    else lenis.current?.stop();
  }, [introDone]);

  useEffect(() => {
    lenis.current?.scrollTo(0, { immediate: true });
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    ScrollTrigger.refresh();
  }, [pathname]);

  return null;
}
