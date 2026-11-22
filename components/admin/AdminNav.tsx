'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

export default function AdminNav({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Control centre" className="flex gap-1 overflow-x-auto md:flex-col">
      {ITEMS.filter((i) => isOwner || !i.ownerOnly).map((i) => {
        const active = i.exact ? pathname === i.href : pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap border-l-2 px-3 py-2 font-mono text-label uppercase transition-colors ${
              active ? 'border-brand-gold text-ink' : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
