'use client';

import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/lib/gsap';
import { advance, createPress, isNear, makeSpots, nextMult, transformFor, type Spot } from '@/lib/emblem-motion';
import { useIntro } from './IntroProvider';

const INTERACTIVE = 'input, textarea, select, [contenteditable="true"]';

/**
 * Brand emblems spread down the whole page, behind the content. They drift against the page and turn as you scroll, turn slowly
 * on their own, and spin up while a press is held anywhere (not on form fields). Static for reduced-motion users.
 */
export default function BackgroundEmblems() {
  const { introDone } = useIntro();
  const [spots, setSpots] = useState<Spot[]>([]);
  const els = useRef<(HTMLImageElement | null)[]>([]);

  // Lay the emblems out for the current page height, and again when it changes (route change, images, window resize).
  useEffect(() => {
    let last = 0;
    const layout = () => {
      const h = Math.max(document.documentElement.scrollHeight, window.innerHeight);
      if (Math.abs(h - last) < 120 && last !== 0) return;
      last = h;
      setSpots(makeSpots(h, window.innerWidth));
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(document.body);
    window.addEventListener('resize', layout);
    return () => { ro.disconnect(); window.removeEventListener('resize', layout); };
  }, []);

  useEffect(() => {
    if (!introDone || spots.length === 0 || prefersReducedMotion()) return;
    const press = createPress();
    const accum = spots.map(() => 0);
    let mult = 1, prev = performance.now(), raf = 0;

    const onDown = (e: PointerEvent) => {
      if (e.button > 0 || (e.target as Element | null)?.closest?.(INTERACTIVE)) return;
      press.down(e.clientX, e.clientY);
    };
    const onMove = (e: PointerEvent) => press.move(e.clientX, e.clientY);
    const onUp = () => press.up();
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onUp, { passive: true });
    window.addEventListener('blur', onUp);

    const frame = (now: number) => {
      const dt = (now - prev) / 1000;
      prev = now;
      mult = nextMult(mult, press.pressed, dt);
      const vh = window.innerHeight, sy = window.scrollY;
      spots.forEach((s, i) => {
        accum[i] = advance(accum[i], s.spin, mult, dt); // keeps turning even when off screen, so nothing jumps back into view
        const el = els.current[i];
        if (!el || !isNear(s, sy, vh)) return;
        const t = transformFor(s, accum[i], sy, vh);
        el.style.transform = `translate(-50%, -50%) translate3d(0, ${t.y.toFixed(1)}px, 0) rotate(${t.rot.toFixed(2)}deg)`;
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onUp);
    };
  }, [spots, introDone]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {spots.map((s, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          ref={(el) => { els.current[i] = el; }}
          src="/brand/emblem.svg"
          alt=""
          draggable={false}
          className="absolute select-none will-change-transform"
          style={{ top: s.top, left: `${s.left}%`, width: s.size, height: s.size, opacity: s.opacity, transform: 'translate(-50%, -50%)' }}
        />
      ))}
    </div>
  );
}
