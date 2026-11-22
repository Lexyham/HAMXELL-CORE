'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { gsap, prefersReducedMotion } from '@/lib/gsap';

interface Props {
  children: ReactNode;
  className?: string;
  /** Fraction of the pointer offset the element follows. Buttons ~0.3, cards ~0.03. */
  strength?: number;
  as?: 'div' | 'span';
}

/** Cursor-following hover: the element eases toward the pointer and settles back on leave. Fine pointers only. */
export default function Magnetic({ children, className, strength = 0.3, as = 'div' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const Tag = as as 'div';

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
    const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - (r.left + r.width / 2)) * strength);
      y((e.clientY - (r.top + r.height / 2)) * strength);
    };
    const leave = () => {
      x(0);
      y(0);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      gsap.set(el, { clearProps: 'transform' });
    };
  }, [strength]);

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
