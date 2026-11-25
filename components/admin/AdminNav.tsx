'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const ITEMS = [
  { label: 'Overview', href: '/admin', exact: true },
  { label: 'Projects', href: '/admin/projects' },
  { label: 'Enquiries', href: '/admin/enquiries' },
  { label: 'Knowledge', href: '/admin/knowledge' },
  { label: 'Importer', href: '/admin/importer' },
  { label: 'Assets', href: '/admin/assets' },
  { label: 'Domains', href: '/admin/domains' },
  { label: 'Deployments', href: '/admin/deployments' },
  { label: 'Analytics', href: '/admin/analytics' },
  { label: 'Vault', href: '/admin/vault', ownerOnly: true },
  { label: 'Archive', href: '/admin/archive', ownerOnly: true },
  { label: 'Settings', href: '/admin/settings' },
  { label: 'Activity', href: '/admin/logs' },
] as { label: string; href: string; exact?: boolean; ownerOnly?: boolean }[];

const MENU_ID = 'admin-mobile-navigation';
const FOCUSABLE = 'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

function NavigationLinks({ isOwner, onNavigate }: { isOwner: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Control centre" className="flex flex-col gap-1">
      {ITEMS.filter((i) => isOwner || !i.ownerOnly).map((i) => {
        const active = i.exact ? pathname === i.href : pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
            className={`flex min-h-[44px] items-center border-l-2 px-3 py-2 font-mono text-label uppercase transition-colors ${
              active ? 'border-brand-gold bg-bg-elevated text-ink' : 'border-transparent text-ink-muted hover:bg-bg-elevated hover:text-ink'
            }`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminNav({ isOwner }: { isOwner: boolean }) {
  return (
    <aside className="hidden border-r border-line bg-bg-secondary lg:block">
      <div className="sticky top-0 px-4 py-4">
        <p className="font-sans text-small font-semibold tracking-[0.18em]">HAMXELL CORE</p>
        <p className="mt-1 font-mono text-label uppercase text-ink-muted">Control centre</p>
        <div className="mt-4">
          <NavigationLinks isOwner={isOwner} />
        </div>
      </div>
    </aside>
  );
}

export function AdminMobileNav({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => trigger.current?.focus());
  }, []);

  useEffect(() => {
    if (open) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => drawer.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus());
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [open]);

  useEffect(() => {
    if (open) close();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const breakpoint = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => {
      if (breakpoint.matches) setOpen(false);
    };
    breakpoint.addEventListener('change', closeOnDesktop);
    window.addEventListener('resize', closeOnDesktop);
    return () => {
      breakpoint.removeEventListener('change', closeOnDesktop);
      window.removeEventListener('resize', closeOnDesktop);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || !drawer.current) return;

      const root = drawer.current;
      const items = root.querySelectorAll<HTMLElement>(FOCUSABLE);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey && (active === root || active === first || !root.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !root.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  return (
    <div className="lg:hidden">
      <div className="flex items-center gap-3">
        <button
          ref={trigger}
          type="button"
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={open}
          aria-controls={MENU_ID}
          aria-haspopup="dialog"
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center border border-line text-ink hover:border-ink focus-visible:outline-offset-2"
        >
          <span aria-hidden className="flex w-4 flex-col gap-1">
            <span className="h-px w-full bg-current" />
            <span className="h-px w-full bg-current" />
            <span className="h-px w-full bg-current" />
          </span>
        </button>
        <div>
          <p className="font-sans text-small font-semibold tracking-[0.18em]">HAMXELL CORE</p>
          <p className="mt-1 font-mono text-label uppercase text-ink-muted">Control centre</p>
        </div>
      </div>

      <div hidden={!open} className="fixed inset-0 z-50 lg:hidden">
        <button
          type="button"
          aria-label="Close navigation menu"
          tabIndex={-1}
          onClick={() => close()}
          className="absolute inset-0 h-full w-full bg-black/70"
        />
        <section
          ref={drawer}
          id={MENU_ID}
          role="dialog"
          tabIndex={-1}
          aria-modal="true"
          aria-label="Control centre navigation"
          className="absolute inset-y-0 left-0 w-[min(20rem,calc(100vw-2rem))] overflow-y-auto border-r border-line bg-bg-secondary px-4 pb-6 pt-4 shadow-2xl"
        >
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-4">
            <div>
              <p className="font-sans text-small font-semibold tracking-[0.18em]">HAMXELL CORE</p>
              <p className="mt-1 font-mono text-label uppercase text-ink-muted">Control centre</p>
            </div>
            <button
              type="button"
              onClick={() => close()}
              className="min-h-[44px] min-w-[44px] border border-line px-3 font-mono text-label uppercase text-ink hover:border-ink"
            >
              Close
            </button>
          </div>
          <NavigationLinks isOwner={isOwner} onNavigate={() => close()} />
        </section>
      </div>
    </div>
  );
}
