'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/lib/gsap';
import { useIntro } from './IntroProvider';

type Phase = 'playing' | 'exiting' | 'done';
const TOTAL_MS = 8200;
const FADE_MS = 300;
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
  const root = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hard = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const restoreMainFocus = useRef(false);

  const exit = useCallback(() => {
    restoreMainFocus.current = Boolean(root.current?.contains(document.activeElement));
    setPhase((p) => {
      if (p !== 'playing') return p;
      try { sessionStorage.setItem(INTRO_SEEN_KEY, '1'); } catch {}
      return 'exiting';
    });
  }, []);

  // The animation starts when the SVG loads, so the hand-off timer starts then too.
  const arm = useCallback(() => {
    if (!timer.current) timer.current = setTimeout(exit, TOTAL_MS);
  }, [exit]);

  useEffect(() => {
    if (phase !== 'playing') return;
    let seen = false;
    try { seen = sessionStorage.getItem(INTRO_SEEN_KEY) === '1'; } catch {}
    if (seen || prefersReducedMotion()) {
      markDone();
      setPhase('done');
      return;
    }
    hard.current = setTimeout(exit, HARD_LIMIT_MS);
    if (img.current?.complete && img.current.naturalWidth > 0) arm(); // loaded before hydration
    return () => { clearTimeout(timer.current); clearTimeout(hard.current); timer.current = undefined; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pathname !== '/' && phase === 'playing') exit();
  }, [pathname, phase, exit]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') exit(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, exit]);

  useEffect(() => {
    if (phase !== 'exiting') return;
    const t = setTimeout(() => {
      markDone();
      setPhase('done');
    }, FADE_MS);
    return () => clearTimeout(t);
  }, [phase, markDone]);

  const active = phase !== 'done';
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    const body = document.body;
    const previous = [html.style.overflow, body.style.overflow, html.style.overscrollBehavior];
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    return () => {
      html.style.overflow = previous[0];
      body.style.overflow = previous[1];
      html.style.overscrollBehavior = previous[2];
    };
  }, [active]);

  useEffect(() => {
    if (phase !== 'done' || !restoreMainFocus.current) return;
    const main = document.querySelector<HTMLElement>('#main');
    if (!main) return;
    main.tabIndex = -1;
    main.focus();
    restoreMainFocus.current = false;
  }, [phase]);

  if (phase === 'done') return null;

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label="HAMXELL CORE introduction"
      data-phase={phase}
      className={`intro-gate fixed inset-0 z-[1000] select-none bg-black transition-opacity ease-out ${phase === 'exiting' ? 'opacity-0' : 'opacity-100'}`}
      style={{ backgroundColor: '#000', transitionDuration: `${FADE_MS}ms` }}
    >
      <button
        type="button"
        onClick={exit}
        aria-label="Skip introduction"
        className="pointer-events-auto absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-10 min-h-[44px] border border-line bg-bg/90 px-4 font-mono text-label uppercase text-ink backdrop-blur hover:border-brand-gold motion-reduce:transition-none"
      >
        Skip
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={img}
        src="/brand/intro.svg"
        alt=""
        aria-hidden="true"
        draggable={false}
        onLoad={arm}
        onError={exit}
        className="absolute inset-0 h-full w-full object-contain [mix-blend-mode:screen]"
      />
    </div>
  );
}
