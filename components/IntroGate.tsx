'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/lib/gsap';
import { useIntro } from './IntroProvider';

type Phase = 'playing' | 'exiting' | 'done';
const TOTAL_MS = 8400;  // the animation in /brand/intro.svg ends at about 8.2 s
const FADE_MS = 900;
const HARD_LIMIT_MS = 16000; // safety net only: if the image never loads, do not leave the visitor on a black screen

/**
 * Landing intro: the animated SVG at /brand/intro.svg. It cannot be skipped or muted (it has no sound).
 * The overlay is part of the server-rendered HTML and the page behind it is hidden by CSS until the intro finishes,
 * so the homepage is never visible first. It plays on every fresh load of "/" and never on in-site navigation.
 * Visitors whose system asks for reduced motion do not see it.
 */
export default function IntroGate() {
  const pathname = usePathname();
  const { markDone } = useIntro();
  const [phase, setPhase] = useState<Phase>(pathname === '/' ? 'playing' : 'done');
  const img = useRef<HTMLImageElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hard = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const exit = useCallback(() => {
    setPhase((p) => (p === 'playing' ? 'exiting' : p));
    markDone(); // page content animates in while the overlay fades out
  }, [markDone]);

  // The animation starts when the SVG loads, so the hand-off timer starts then too.
  const arm = useCallback(() => {
    if (!timer.current) timer.current = setTimeout(exit, TOTAL_MS);
  }, [exit]);

  useEffect(() => {
    if (phase !== 'playing') return;
    if (prefersReducedMotion()) { setPhase('done'); markDone(); return; }
    hard.current = setTimeout(exit, HARD_LIMIT_MS);
    if (img.current?.complete && img.current.naturalWidth > 0) arm(); // loaded before hydration
    return () => { clearTimeout(timer.current); clearTimeout(hard.current); timer.current = undefined; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
