'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/lib/gsap';
import { useIntro } from './IntroProvider';

type Phase = 'playing' | 'exiting' | 'done';
const TOTAL_MS = 6200;
const FADE_MS = 500;
const HARD_LIMIT_MS = 10000;
const INTRO_SEEN_KEY = 'hamxell-intro-seen';

/**
 * Landing intro: an optional, skippable animated SVG at /brand/intro.svg.
 * First visits get the short introduction once per browser session; returning visits skip it.
 * Reduced-motion users and keyboard users are never forced through the animation.
 */
export default function IntroGate() {
  const pathname = usePathname();
  const { markDone } = useIntro();
  const [phase, setPhase] = useState<Phase>(pathname === '/' ? 'playing' : 'done');
  const img = useRef<HTMLImageElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hard = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const exit = useCallback(() => {
    setPhase((p) => {
      if (p !== 'playing') return p;
      try { sessionStorage.setItem(INTRO_SEEN_KEY, '1'); } catch {}
      return 'exiting';
    });
    markDone();
  }, [markDone]);

  // The animation starts when the SVG loads, so the hand-off timer starts then too.
  const arm = useCallback(() => {
    if (!timer.current) timer.current = setTimeout(exit, TOTAL_MS);
  }, [exit]);

  useEffect(() => {
    if (phase !== 'playing') return;
    let seen = false;
    try { seen = sessionStorage.getItem(INTRO_SEEN_KEY) === '1'; } catch {}
    if (seen || prefersReducedMotion()) { setPhase('done'); markDone(); return; }
    hard.current = setTimeout(exit, HARD_LIMIT_MS);
    if (img.current?.complete && img.current.naturalWidth > 0) arm(); // loaded before hydration
    return () => { clearTimeout(timer.current); clearTimeout(hard.current); timer.current = undefined; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') exit(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, exit]);

  useEffect(() => {
    if (phase !== 'exiting') return;
    const t = setTimeout(() => setPhase('done'), FADE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // Lock scrolling (including mobile rubber-banding) while the intro is on screen.
  useEffect(() => {
    if (phase !== 'playing') return;
    const html = document.documentElement, body = document.body;
    const prev = [html.style.overflow, body.style.overflow, html.style.overscrollBehavior];
    html.style.overflow = 'hidden'; body.style.overflow = 'hidden'; html.style.overscrollBehavior = 'none';
    return () => { html.style.overflow = prev[0]; body.style.overflow = prev[1]; html.style.overscrollBehavior = prev[2]; };
  }, [phase]);

  if (phase === 'done') return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="HAMXELL CORE introduction"
      data-phase={phase}
      className={`intro-gate fixed inset-0 z-[1000] touch-none select-none bg-black transition-opacity ease-out ${phase === 'exiting' ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <button
        type="button"
        onClick={exit}
        aria-label="Skip introduction"
        className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-10 min-h-[44px] border border-line bg-bg/90 px-4 font-mono text-label uppercase text-ink backdrop-blur hover:border-brand-gold motion-reduce:transition-none"
      >
        Skip
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={img}
        src="/brand/intro.svg"
        alt="HAMXELL CORE"
        draggable={false}
        onLoad={arm}
        onError={exit}
        className="absolute inset-0 h-full w-full object-contain"
      />
    </div>
  );
}
