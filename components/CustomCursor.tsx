'use client';

import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '@/lib/gsap';
import { LONG_PRESS_MS } from '@/lib/emblem-motion';
import { useIntro } from './IntroProvider';

const INTERACTIVE = 'a, button, summary, label, select, [role="button"]';
const TEXTY = 'input, textarea, [contenteditable="true"]';

/**
 * A dot that follows the pointer exactly and a ring that trails it. The ring grows over links and buttons, shrinks while pressed and
 * turns gold during a long press (when the background emblems spin up). Only for fine pointers; touch and reduced-motion users keep
 * their normal cursor, and over text fields the native text cursor returns.
 */
export default function CustomCursor() {
  const { introDone } = useIntro();
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!introDone || prefersReducedMotion() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const root = document.documentElement;
    root.classList.add('has-cursor');
    let x = -100, y = -100, rx = -100, ry = -100, scale = 1, target = 1, raf = 0, hold: ReturnType<typeof setTimeout> | undefined, seen = false;

    const over = (t: EventTarget | null) => {
      const el = t instanceof Element ? t : null;
      root.classList.toggle('cursor-text', !!el?.closest(TEXTY));
      target = el?.closest(INTERACTIVE) ? 1.8 : 1;
    };
    const move = (e: PointerEvent) => { x = e.clientX; y = e.clientY; if (!seen) { seen = true; rx = x; ry = y; root.classList.add('cursor-live'); } over(e.target); };
    const down = () => { target = 0.7; hold = setTimeout(() => ring.current?.classList.add('is-holding'), LONG_PRESS_MS); };
    const up = (e: Event) => { clearTimeout(hold); ring.current?.classList.remove('is-holding'); over((e as PointerEvent).target); };
    const leave = () => root.classList.remove('cursor-live');
    const enter = () => seen && root.classList.add('cursor-live');

    const frame = () => {
      rx += (x - rx) * 0.18; ry += (y - ry) * 0.18; scale += (target - scale) * 0.2;
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0) scale(${scale.toFixed(3)})`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    window.addEventListener('pointercancel', up, { passive: true });
    document.documentElement.addEventListener('mouseleave', leave);
    document.documentElement.addEventListener('mouseenter', enter);
    return () => {
      cancelAnimationFrame(raf); clearTimeout(hold);
      root.classList.remove('has-cursor', 'cursor-live', 'cursor-text');
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      document.documentElement.removeEventListener('mouseleave', leave); document.documentElement.removeEventListener('mouseenter', enter);
    };
  }, [introDone]);

  return (
    <div aria-hidden className="hxc-cursor pointer-events-none fixed left-0 top-0 z-[999]">
      <div ref={ring} className="hxc-ring absolute left-[-15px] top-[-15px] h-[30px] w-[30px] border border-brand-blue" />
      <div ref={dot} className="absolute left-[-3px] top-[-3px] h-[6px] w-[6px] bg-brand-gold" />
    </div>
  );
}
