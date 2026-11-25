import type { IncomingHttpHeaders } from 'node:http';
import type { SiteCrawl } from './crawl';
import type { SiteDescription } from './describe';
import type { RepoFacts } from './github';

export interface TechHit { name: string; evidence: string }
export interface Observed {
  title: string;
  description: string;
  canonical: string;
  lang: string;
  favicon: string;
  og: Record<string, string>;
  headings: string[];
  nav: { text: string; href: string }[];
  buttons: string[];
  forms: number;
  scriptHosts: string[];
  server: string;
  poweredBy: string;
}
export interface ImportResult {
  sourceUrl: string;
  finalUrl: string;
  fetchedAt: string;
  observed: Observed;
  features: string[];
  tech: TechHit[];
  notes: string[];
  files: Record<string, string>;
  /** Added by the multi-page crawl (schema 2). Older stored imports do not have these. */
  schema?: 2;
  crawl?: SiteCrawl;
  repo?: RepoFacts;
  repoError?: string;
  /** The written description of the site, produced silently after the crawl. */
  description?: SiteDescription;
}

const ENT: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
export const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENT[m] ?? m);
export const strip = (s: string) => decode(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const uniq = <T,>(a: T[]) => Array.from(new Set(a));

export function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? '');
  return out;
}
export const abs = (href: string, base: string) => {
  try { return new URL(href, base).toString(); } catch { return ''; }
};

const SIGNATURES: { name: string; test: (h: string, hd: IncomingHttpHeaders) => string | null }[] = [
  { name: 'Next.js', test: (h, hd) => (/\/_next\/|__NEXT_DATA__/.test(h) ? 'references /_next/ assets' : /next\.js/i.test(String(hd['x-powered-by'] ?? '')) ? 'x-powered-by header' : null) },
  { name: 'React', test: (h) => (/data-reactroot|react(?:\.production|-dom)|__reactFiber/i.test(h) ? 'React markers in page source' : null) },
  { name: 'Nuxt / Vue', test: (h) => (/\/_nuxt\/|__NUXT__/.test(h) ? 'references /_nuxt/ assets' : /data-v-[0-9a-f]{6,}|vue(?:\.runtime|\.global)/i.test(h) ? 'Vue markers in page source' : null) },
  { name: 'Angular', test: (h) => (/ng-version=|<app-root/i.test(h) ? 'ng-version or <app-root>' : null) },
  { name: 'Svelte / SvelteKit', test: (h) => (/\/_app\/immutable\/|svelte-[a-z0-9]{6}/i.test(h) ? 'Svelte asset paths or class hashes' : null) },
  { name: 'Astro', test: (h) => (/astro-island|\/_astro\//.test(h) ? 'astro-island or /_astro/ assets' : null) },
  { name: 'WordPress', test: (h) => (/\/wp-content\/|\/wp-includes\//.test(h) ? 'references /wp-content/' : null) },
  { name: 'Shopify', test: (h) => (/cdn\.shopify\.com|Shopify\.theme/.test(h) ? 'references cdn.shopify.com' : null) },
  { name: 'Webflow', test: (h) => (/data-wf-(page|site)|webflow\.com/i.test(h) ? 'Webflow attributes' : null) },
  { name: 'Wix', test: (h) => (/static\.wixstatic\.com|wix-/i.test(h) ? 'references wixstatic.com' : null) },
  { name: 'Squarespace', test: (h) => (/static1\.squarespace\.com|squarespace-cdn/i.test(h) ? 'references squarespace assets' : null) },
  { name: 'Tailwind CSS', test: (h) => (/class="[^"]*\b(?:flex|grid|px-\d|py-\d|text-(?:sm|lg|xl)|bg-[a-z]+-\d{3})\b[^"]*\b(?:px-\d|py-\d|gap-\d|rounded|items-center)\b/.test(h) ? 'utility-class patterns in markup (low confidence)' : null) },
  { name: 'Bootstrap', test: (h) => (/bootstrap(?:\.min)?\.(?:css|js)|class="[^"]*\bcol-(?:md|lg|sm)-\d/i.test(h) ? 'Bootstrap assets or grid classes' : null) },
  { name: 'jQuery', test: (h) => (/jquery(?:\.min)?\.js|code\.jquery\.com/i.test(h) ? 'references jQuery' : null) },
  { name: 'Google Analytics / Tag Manager', test: (h) => (/googletagmanager\.com|google-analytics\.com|gtag\(/.test(h) ? 'Google tag scripts' : null) },
  { name: 'Google Fonts', test: (h) => (/fonts\.(?:googleapis|gstatic)\.com/.test(h) ? 'references Google Fonts' : null) },
  { name: 'Vercel (hosting)', test: (_h, hd) => (hd['x-vercel-id'] || /vercel/i.test(String(hd.server ?? '')) ? 'x-vercel-id / server header' : null) },
  { name: 'Netlify (hosting)', test: (_h, hd) => (hd['x-nf-request-id'] || /netlify/i.test(String(hd.server ?? '')) ? 'netlify response header' : null) },
  { name: 'Cloudflare (CDN)', test: (_h, hd) => (hd['cf-ray'] || /cloudflare/i.test(String(hd.server ?? '')) ? 'cf-ray / server header' : null) },
];

const FEATURE_RULES: [RegExp, string][] = [
  [/sign ?in|log ?in|login|sign ?up|register|create account/i, 'Account sign-in or registration'],
  [/add to (cart|bag)|checkout|buy now|basket/i, 'Online shopping or checkout'],
  [/contact|get in touch|enquir|inquir/i, 'Contact or enquiry route'],
  [/pricing|plans|subscribe|subscription/i, 'Pricing or subscription information'],
  [/blog|articles|news|insights/i, 'Blog or news content'],
  [/docs|documentation|api reference|developers/i, 'Documentation or developer resources'],
  [/book|schedule|reserve|appointment/i, 'Booking or scheduling'],
  [/download|get the app|app store|google play/i, 'Downloads or app distribution'],
  [/search/i, 'Search'],
  [/dashboard|portal/i, 'Dashboard or portal entry point'],
];

export function analyzeHtml(html: string, headers: IncomingHttpHeaders, finalUrl: string, sourceUrl = finalUrl): ImportResult {
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');

  const metas = Array.from(html.matchAll(/<meta\s[^>]*>/gi)).map((m) => attrs(m[0]));
  const meta = (key: string) => metas.find((m) => (m.name ?? m.property ?? '').toLowerCase() === key)?.content ?? '';
  const og: Record<string, string> = {};
  for (const m of metas) if ((m.property ?? '').startsWith('og:') && m.content) og[m.property] = m.content;

  const links = Array.from(html.matchAll(/<link\s[^>]*>/gi)).map((m) => attrs(m[0]));
  const icon = links.find((l) => /(^|\s)(shortcut )?icon(\s|$)|apple-touch-icon/i.test(l.rel ?? ''))?.href;
  const canonical = links.find((l) => (l.rel ?? '').toLowerCase() === 'canonical')?.href ?? '';

  const title = strip(clean.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '') || og['og:title'] || '';
  const headings = uniq(Array.from(clean.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)).map((m) => strip(m[1])).filter(Boolean)).slice(0, 24);

  const nav: { text: string; href: string }[] = [];
  for (const block of clean.matchAll(/<nav[\s\S]*?<\/nav>/gi)) {
    for (const a of block[0].matchAll(/<a\s[^>]*>([\s\S]*?)<\/a>/gi)) {
      const text = strip(a[1]);
      const href = attrs(a[0].match(/<a\s[^>]*>/i)![0]).href ?? '';
      if (text && text.length < 50 && !nav.some((n) => n.text === text)) nav.push({ text, href: abs(href, finalUrl) || href });
    }
  }
  const buttons = uniq([
    ...Array.from(clean.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi)).map((m) => strip(m[1])),
    ...Array.from(clean.matchAll(/<input\s[^>]*type=["'](?:submit|button)["'][^>]*>/gi)).map((m) => attrs(m[0]).value ?? ''),
  ].filter((t) => t && t.length < 50)).slice(0, 20);
  const forms = (clean.match(/<form[\s>]/gi) ?? []).length;
  const scriptHosts = uniq(Array.from(html.matchAll(/<script\s[^>]*src=["']([^"']+)["']/gi)).map((m) => { try { return new URL(m[1], finalUrl).hostname; } catch { return ''; } }).filter(Boolean)).slice(0, 15);

  const observed: Observed = {
    title,
    description: meta('description') || og['og:description'] || '',
    canonical: canonical ? abs(canonical, finalUrl) : '',
    lang: html.match(/<html[^>]*\slang=["']([^"']+)["']/i)?.[1] ?? '',
    favicon: icon ? abs(icon, finalUrl) : abs('/favicon.ico', finalUrl),
    og,
    headings,
    nav,
    buttons,
    forms,
    scriptHosts,
    server: String(headers.server ?? ''),
    poweredBy: String(headers['x-powered-by'] ?? ''),
  };

  const tech: TechHit[] = [];
  for (const s of SIGNATURES) {
    const ev = s.test(html, headers);
    if (ev) tech.push({ name: s.name, evidence: ev });
  }

  const visible = [...nav.map((n) => n.text), ...buttons, ...headings].join(' | ');
  const features = FEATURE_RULES.filter(([re]) => re.test(visible)).map(([, label]) => label);
  if (forms > 0) features.push(`${forms} form${forms > 1 ? 's' : ''} on the landing page`);
  if (/<input[^>]*type=["']search["']/i.test(clean) && !features.includes('Search')) features.push('Search');

  const notes = [
    'Only the landing page was analysed, not the whole site.',
    'Backend logic, database schema, authentication internals and private endpoints cannot be discovered from a public URL. Connect the repository or add them manually.',
  ];
  const r: ImportResult = { sourceUrl, finalUrl, fetchedAt: new Date().toISOString(), observed, features, tech, notes, files: {} };
  return r;
}
