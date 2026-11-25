import type { IncomingHttpHeaders } from 'node:http';
import { extractContent, type PageContent } from './content';
import { extractFacts, sameSite, type Facts } from './facts';
import { CrawlError, robotsAllows, robotsSitemaps, type FetchOpts, type Fetched } from './safe-fetch';

export type Fetcher = (url: string, opts?: FetchOpts) => Promise<Fetched>;

export interface PageAudit {
  url: string; finalUrl: string; status: number; ms: number; bytes: number; contentType: string;
  title: string; description: string; h1: number; words: number; canonical: string; noindex: boolean; imagesMissingAlt: number;
  error?: string; skipped?: string;
}

export interface SiteCrawl {
  sourceUrl: string; finalUrl: string; fetchedAt: string; redirected: boolean;
  home: { facts: Facts; headers: IncomingHttpHeaders; status: number; ms: number; truncated: boolean };
  pages: PageAudit[];
  robots: { present: boolean; status: number | null; disallowsAll: boolean; sitemaps: string[] };
  sitemap: { url: string; status: number | null; urls: number; isIndex: boolean };
  compression: string | null;
  linkChecks: { url: string; status: number }[];
  internalLinksFound: number;
  truncatedCrawl: boolean;
  limits: { maxPages: number; linkChecks: number };
  /** What each fetched page says (headings, excerpts, calls to action). Absent on imports made before descriptions existed. */
  content?: PageContent[];
}

export interface CrawlDeps {
  fetch: Fetcher;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  maxPages?: number; linkChecks?: number; deadlineMs?: number; delayMs?: number;
}

const FILE_EXT = /\.(pdf|jpe?g|png|gif|webp|svg|ico|zip|gz|mp4|mp3|mov|css|js|json|xml|txt|csv|docx?|xlsx?|pptx?)(\?|$)/i;
const isHtml = (h: IncomingHttpHeaders) => /html|xml/i.test(String(h['content-type'] ?? ''));
const key = (u: string) => { try { const x = new URL(u); return `${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/$/, '') || '/'}${x.search}`; } catch { return u; } };

function pageRow(url: string, f: Fetched, ms: number, facts: Facts | null): PageAudit {
  return {
    url, finalUrl: f.url, status: f.status, ms, bytes: Buffer.byteLength(f.body), contentType: String(f.headers['content-type'] ?? ''),
    title: facts?.title ?? '', description: facts?.description ?? '', h1: facts?.headings.filter((h) => h.level === 1).length ?? 0, words: facts?.words ?? 0,
    canonical: facts?.canonical ?? '', noindex: /noindex/.test(facts?.robotsMeta ?? '') || /noindex/i.test(String(f.headers['x-robots-tag'] ?? '')), imagesMissingAlt: facts?.images.missingAlt ?? 0,
  };
}

/**
 * Reviews a site the way a polite crawler would: robots.txt first, the start page, then up to `maxPages - 1` further internal pages
 * (navigation links first), a status probe of other internal links, the sitemap, and a compression probe. Everything is bounded by a deadline.
 */
export async function crawlSite(start: string, d: CrawlDeps): Promise<{ crawl: SiteCrawl; homeRaw: Fetched }> {
  const now = d.now ?? Date.now, sleep = d.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxPages = d.maxPages ?? 6, linkChecks = d.linkChecks ?? 20, deadline = d.deadlineMs ?? 60_000, delay = d.delayMs ?? 250;
  const t0 = now();
  const over = () => now() - t0 > deadline;
  const origin = new URL(start).origin;

  // robots.txt
  const robots: SiteCrawl['robots'] = { present: false, status: null, disallowsAll: false, sitemaps: [] };
  let robotsBody = '';
  try {
    const r = await d.fetch(`${origin}/robots.txt`);
    robots.status = r.status;
    const looksHtml = /<html|<!doctype/i.test(r.body.slice(0, 400));
    if (r.status === 200 && !looksHtml) {
      robots.present = true; robotsBody = r.body;
      robots.sitemaps = robotsSitemaps(r.body);
      robots.disallowsAll = !robotsAllows(r.body, '/', '*');
    }
  } catch { /* unreachable robots.txt is treated as absent */ }
  const allowed = (u: string) => { if (!robotsBody) return true; try { const x = new URL(u); return robotsAllows(robotsBody, x.pathname + x.search); } catch { return false; } };
  const s0 = new URL(start);
  if (!allowed(start)) throw new CrawlError('robots.txt disallows crawling this page.');

  // start page
  const t1 = now();
  const homeRaw = await d.fetch(start);
  const homeMs = now() - t1;
  if (homeRaw.status >= 400) throw new CrawlError(`The site responded with HTTP ${homeRaw.status}.`);
  if (!isHtml(homeRaw.headers)) throw new CrawlError(`Expected an HTML page but received ${String(homeRaw.headers['content-type'] ?? 'an unknown content type')}.`);
  const facts = extractFacts(homeRaw.body, homeRaw.url);
  const pages: PageAudit[] = [pageRow(start, homeRaw, homeMs, facts)];
  const content: PageContent[] = [extractContent(homeRaw.body, homeRaw.url)];

  // candidate internal pages: navigation first, then every other internal link
  const homeKey = key(homeRaw.url);
  const seen = new Set<string>([homeKey]);
  const candidates: string[] = [];
  for (const u of [...facts.nav.map((n) => n.href), ...facts.links.internal]) {
    if (!/^https?:/i.test(u) || !sameSite(u, homeRaw.url) || FILE_EXT.test(u) || seen.has(key(u))) continue;
    seen.add(key(u)); candidates.push(u);
  }

  let truncatedCrawl = false;
  for (const u of candidates.slice(0, Math.max(0, maxPages - 1))) {
    if (over()) { truncatedCrawl = true; break; }
    if (!allowed(u)) { pages.push({ url: u, finalUrl: u, status: 0, ms: 0, bytes: 0, contentType: '', title: '', description: '', h1: 0, words: 0, canonical: '', noindex: false, imagesMissingAlt: 0, skipped: 'disallowed by robots.txt' }); continue; }
    await sleep(delay);
    const t = now();
    try {
      const f = await d.fetch(u);
      const okHtml = f.status < 400 && isHtml(f.headers);
      pages.push(pageRow(u, f, now() - t, okHtml ? extractFacts(f.body, f.url) : null));
      if (okHtml) content.push(extractContent(f.body, f.url));
    } catch (e) {
      pages.push({ url: u, finalUrl: u, status: 0, ms: now() - t, bytes: 0, contentType: '', title: '', description: '', h1: 0, words: 0, canonical: '', noindex: false, imagesMissingAlt: 0, error: e instanceof CrawlError ? e.message : 'could not be fetched' });
    }
  }

  // status probe of the remaining internal links (headers only, a few at a time)
  const rest = candidates.slice(Math.max(0, maxPages - 1)).filter(allowed).slice(0, linkChecks);
  const checks: { url: string; status: number }[] = [];
  for (let i = 0; i < rest.length && !over(); i += 4) {
    const batch = rest.slice(i, i + 4);
    checks.push(...(await Promise.all(batch.map(async (url) => {
      try { return { url, status: (await d.fetch(url, { headersOnly: true })).status }; } catch { return { url, status: 0 }; }
    }))));
    await sleep(delay);
  }
  if (over() && rest.length > checks.length) truncatedCrawl = true;

  // sitemap
  const sitemapUrl = robots.sitemaps[0] ?? `${origin}/sitemap.xml`;
  const sitemap: SiteCrawl['sitemap'] = { url: sitemapUrl, status: null, urls: 0, isIndex: false };
  try {
    const r = await d.fetch(sitemapUrl);
    sitemap.status = r.status;
    if (r.status === 200 && /<urlset|<sitemapindex/i.test(r.body)) { sitemap.isIndex = /<sitemapindex/i.test(r.body); sitemap.urls = (r.body.match(/<loc>/gi) ?? []).length; }
    else if (r.status === 200) sitemap.status = 204; // 200 but not a sitemap (a soft 404)
  } catch { /* leave as unreachable */ }

  // compression probe
  let compression: string | null = null;
  try { compression = String((await d.fetch(start, { headersOnly: true, acceptEncoding: 'br, gzip' })).headers['content-encoding'] ?? '') || null; } catch { /* unknown */ }

  return {
    homeRaw,
    crawl: {
      sourceUrl: start, finalUrl: homeRaw.url, fetchedAt: new Date(t0).toISOString(), redirected: key(start) !== key(homeRaw.url) || s0.protocol !== new URL(homeRaw.url).protocol,
      home: { facts, headers: homeRaw.headers, status: homeRaw.status, ms: homeMs, truncated: homeRaw.truncated },
      pages, robots, sitemap, compression, linkChecks: checks, internalLinksFound: candidates.length, truncatedCrawl, limits: { maxPages, linkChecks }, content,
    },
  };
}
