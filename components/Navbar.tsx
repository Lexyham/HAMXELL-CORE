'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NAV, SITE } from '@/lib/site';
import { useIntro } from './IntroProvider';
import Magnetic from './Magnetic';

export default function Navbar() {
  const pathname = usePathname();
  const { introDone } = useIntro();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const linkCls = (href: string) =>
    `font-mono text-label uppercase transition-colors duration-200 ease-out hover:text-ink ${
      pathname.startsWith(href) ? 'text-ink' : 'text-ink-muted'
    }`;

  return (
    <header
      className={`sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur transition-[transform,opacity] duration-700 ease-out ${
        introDone ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
    >
      <a
        href="#main"
        className="absolute left-4 top-[-4rem] bg-brand-gold px-3 py-2 text-small text-bg focus:top-2"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-[3.5rem] w-full max-w-page items-center justify-between px-[var(--gutter)]">
        <Magnetic as="span" strength={0.15} className="inline-block">
          <Link href="/" className="flex items-center gap-3" aria-label={`${SITE.name} home`}>
            <Image src="/brand/logo.png" alt="" width={28} height={28} priority className="h-[28px] w-[28px]" />
            <span className="font-sans text-small font-semibold tracking-[0.18em]">{SITE.name}</span>
          </Link>
        </Magnetic>

        <nav aria-label="Primary" className="hidden items-center gap-5 md:flex">
          {NAV.map((n) => (
            <Magnetic key={n.href} as="span" strength={0.35} className="inline-block px-1 py-2">
              <Link href={n.href} className={linkCls(n.href)}>
                {n.label}
              </Link>
            </Magnetic>
          ))}
        </nav>

        <button
          type="button"
          className="min-h-[44px] border border-line px-3 py-2 font-mono text-label uppercase text-ink md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line bg-bg md:hidden">
          <ul className="mx-auto w-full max-w-page px-[var(--gutter)]">
            {NAV.map((n) => (
              <li key={n.href} className="border-b border-line last:border-b-0">
                <Link href={n.href} className={`block py-4 ${linkCls(n.href)}`}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
