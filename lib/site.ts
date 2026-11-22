export const SITE = {
  name: 'HAMXELL CORE',
  tagline: 'One ecosystem. Multiple products. One identity.',
  description:
    'HAMXELL CORE is a technology laboratory building software, AI products and experimental systems.',
} as const;

export type NavItem = { label: string; href: string };

/** Public navigation only. Nothing in here may reference the private control centre. */
export const NAV: NavItem[] = [
  { label: 'Products', href: '/products' },
  { label: 'Experiments', href: '/experiments' },
  { label: 'Labs', href: '/labs' },
  { label: 'Docs', href: '/docs' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];
