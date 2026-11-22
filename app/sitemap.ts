import type { MetadataRoute } from 'next';
import { listDocProjects } from '@/lib/docs';
import { flag } from '@/lib/flags';
import { listPublic } from '@/lib/projects';

export const dynamic = 'force-dynamic';

/** Public pages only: no control-centre routes, no unlisted (/u) or warning-gated (/p) projects. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const fixed = ['/', '/products', '/experiments', '/labs', '/docs', '/about', '/contact', ...(flag('FEATURE_LICENSING') ? ['/licenses'] : [])];
  const [projects, docs] = await Promise.all([listPublic(), listDocProjects()]);
  return [
    ...fixed.map((p) => ({ url: `${base}${p}` })),
    ...projects.filter((p) => !p.placeholder).map((p) => ({ url: `${base}/products/${p.slug}` })),
    ...docs.map((d) => ({ url: `${base}/docs/${d.slug}` })),
  ];
}
