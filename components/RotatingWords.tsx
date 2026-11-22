'use client';

import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '@/lib/gsap';
import { useIntro } from './IntroProvider';

/**
 * Cycles through short phrases in place. All phrases occupy the same grid cell, so the width is that of the longest and the
 * surrounding text never jumps. Screen readers get the full list once; reduced-motion users see the phrases joined, not animated.
 */
export default function RotatingWords({ words, className = '' }: { words: string[]; className?: string }) {
  const [i, setI] = useState(0);
  const [prev, setPrev] = useState(-1);
  const [still, setStill] = useState(false);
  const { introDone } = useIntro(); // start only once the page is visible, so the first phrase is seen

  useEffect(() => {
    if (prefersReducedMotion()) { setStill(true); return; }
    if (!introDone) return;
    const t = setInterval(() => setI((v) => { setPrev(v); return (v + 1) % words.length; }), 2600);
    return () => clearInterval(t);
  }, [words.length, introDone]);

  if (still) return <span className={className}>{words.join(', ')}</span>;
  return (
    <span className={className}>
      <span className="sr-only">{words.join(', ')}</span>
      <span aria-hidden className="inline-grid align-bottom">
        {words.map((w, k) => (
          <span key={w} style={{ gridArea: '1 / 1' }} className={`rw ${k === i ? 'rw-active' : k === prev ? 'rw-out' : 'rw-idle'}`}>{w}</span>
        ))}
      </span>
    </span>
  );
}
