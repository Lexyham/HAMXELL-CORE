import type { MetadataRoute } from 'next';

/** The control centre is deliberately not mentioned here: robots.txt is public, and /admin is protected by noindex headers and authentication. */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return { rules: [{ userAgent: '*', allow: '/' }], sitemap: `${base}/sitemap.xml` };
}
