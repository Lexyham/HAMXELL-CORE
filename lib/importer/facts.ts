import { abs, attrs, strip } from './analyze';

/** Everything the audit needs to know about one HTML page, extracted without a DOM (regular expressions over the markup). */
export interface Facts {
  title: string; description: string; canonical: string; lang: string; viewport: string; robotsMeta: string; favicon: string;
  og: Record<string, string>; twitter: Record<string, string>; jsonLd: number; hreflang: number;
  headings: { level: number; text: string }[];
  nav: { text: string; href: string }[];
  buttons: string[]; unnamedButtons: number; forms: number;
  controls: { total: number; unlabelled: number };
  images: { total: number; missingAlt: number; noDimensions: number; lazy: number };
  links: { internal: string[]; externalHosts: string[]; unnamed: number; total: number };
  scripts: { external: number; inline: number; blocking: number; thirdPartyHosts: string[] };
  styles: { external: number; inline: number; thirdPartyHosts: string[] };
  landmarks: { main: boolean; nav: boolean; header: boolean; footer: boolean };
  skipLink: boolean; words: number; mixedContent: string[]; iframes: number; bytes: number;
}

const host = (u: string) => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } };
const bare = (h: string) => h.replace(/^www\./, '');
export const sameSite = (a: string, b: string) => bare(host(a)) === bare(host(b)) && host(a) !== '';
const uniq = <T,>(a: T[]) => Array.from(new Set(a));
const normalise = (u: string) => { try { const x = new URL(u); x.hash = ''; return x.toString(); } catch { return ''; } };

export function extractFacts(html: string, finalUrl: string): Facts {
  const noComments = html.replace(/<!--[\s\S]*?-->/g, ' ');
  const headStart = noComments.search(/<head[\s>]/i), headEnd = noComments.search(/<\/head>/i);
  const clean = noComments.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  const body = clean.replace(/<head[\s>][\s\S]*?<\/head>/i, ' ');
  const own = host(finalUrl);
  const https = /^https:/i.test(finalUrl);

  const metas = Array.from(noComments.matchAll(/<meta\s[^>]*>/gi)).map((m) => attrs(m[0]));
  const meta = (k: string) => metas.find((m) => (m.name ?? m.property ?? '').toLowerCase() === k)?.content ?? '';
  const og: Record<string, string> = {}, twitter: Record<string, string> = {};
  for (const m of metas) {
    const key = (m.property ?? m.name ?? '').toLowerCase();
    if (key.startsWith('og:') && m.content) og[key] = m.content;
    if (key.startsWith('twitter:') && m.content) twitter[key] = m.content;
  }
  const links = Array.from(noComments.matchAll(/<link\s[^>]*>/gi)).map((m) => attrs(m[0]));
  const rel = (l: Record<string, string>, r: string) => (l.rel ?? '').toLowerCase().split(/\s+/).includes(r);
  const icon = links.find((l) => rel(l, 'icon') || rel(l, 'apple-touch-icon'))?.href;
  const canonical = links.find((l) => rel(l, 'canonical'))?.href;

  // headings
  const headings = Array.from(body.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)).map((m) => ({ level: Number(m[1]), text: strip(m[2]) })).filter((h) => h.text);

  // anchors
  const anchors = Array.from(body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)).map((m) => {
    const a = attrs(`<a ${m[1]}>`);
    const imgAlt = m[2].match(/<img\b[^>]*\salt\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
    const text = strip(m[2]) || (a['aria-label'] ?? '').trim() || (a.title ?? '').trim() || imgAlt.trim();
    return { href: a.href ?? '', text, hasHref: 'href' in a };
  });
  const navText: { text: string; href: string }[] = [];
  for (const block of body.matchAll(/<nav\b[\s\S]*?<\/nav>/gi)) {
    for (const m of block[0].matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
      const text = strip(m[2]), href = attrs(`<a ${m[1]}>`).href ?? '';
      if (text && text.length < 50 && !navText.some((n) => n.text === text)) navText.push({ text, href: abs(href, finalUrl) || href });
    }
  }
  const internal: string[] = [], externalHosts: string[] = [];
  for (const a of anchors) {
    if (!a.hasHref || /^(#|mailto:|tel:|javascript:|sms:)/i.test(a.href.trim())) continue;
    const u = normalise(abs(a.href, finalUrl));
    if (!u || !/^https?:/i.test(u)) continue;
    if (sameSite(u, finalUrl)) internal.push(u); else externalHosts.push(host(u));
  }

  // buttons
  const btns = Array.from(body.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)).map((m) => {
    const a = attrs(`<button ${m[1]}>`);
    return strip(m[2]) || (a['aria-label'] ?? '').trim() || (a.title ?? '').trim();
  });
  const submitInputs = Array.from(body.matchAll(/<input\s[^>]*type\s*=\s*["'](?:submit|button)["'][^>]*>/gi)).map((m) => attrs(m[0]).value ?? '').filter(Boolean);

  // form controls and their labels
  const labelFor = new Set(Array.from(body.matchAll(/<label\b([^>]*)>/gi)).map((m) => attrs(`<label ${m[1]}>`).for).filter(Boolean));
  const labelRanges = Array.from(body.matchAll(/<label\b[^>]*>[\s\S]*?<\/label>/gi)).map((m) => [m.index ?? 0, (m.index ?? 0) + m[0].length]);
  let total = 0, unlabelled = 0;
  for (const m of body.matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if (m[1].toLowerCase() === 'input' && /^(hidden|submit|button|reset|image)$/i.test(a.type ?? 'text')) continue;
    total++;
    const idx = m.index ?? 0;
    const labelled = Boolean((a['aria-label'] ?? '').trim() || (a['aria-labelledby'] ?? '').trim() || (a.title ?? '').trim() || (a.id && labelFor.has(a.id)) || labelRanges.some(([s, e]) => idx >= s && idx < e));
    if (!labelled) unlabelled++;
  }

  // images
  let imgTotal = 0, missingAlt = 0, noDims = 0, lazy = 0;
  for (const m of body.matchAll(/<img\b[^>]*>/gi)) {
    imgTotal++;
    const a = attrs(m[0]);
    if (!/\salt\s*=/i.test(m[0]) && !/^(presentation|none)$/i.test(a.role ?? '')) missingAlt++;
    if (!('width' in a && 'height' in a)) noDims++;
    if (/^lazy$/i.test(a.loading ?? '')) lazy++;
  }

  // scripts and styles
  let ldJson = 0, extScripts = 0, inlineScripts = 0, blocking = 0;
  const thirdScripts: string[] = [];
  for (const m of noComments.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const a = attrs(`<script ${m[1]}>`);
    if (/ld\+json/i.test(a.type ?? '')) { ldJson++; continue; }
    if (a.src) {
      extScripts++;
      const u = abs(a.src, finalUrl), h = host(u);
      if (h && !sameSite(u, finalUrl)) thirdScripts.push(h);
      const idx = m.index ?? 0;
      if (headStart >= 0 && idx > headStart && idx < (headEnd < 0 ? Infinity : headEnd) && !('async' in a) && !('defer' in a) && !/module/i.test(a.type ?? '')) blocking++;
    } else inlineScripts++;
  }
  const sheets = links.filter((l) => rel(l, 'stylesheet') && l.href);
  const thirdStyles = sheets.map((l) => abs(l.href, finalUrl)).filter((u) => host(u) && !sameSite(u, finalUrl)).map(host);

  // mixed content on an https page
  const mixed: string[] = [];
  if (https) {
    for (const m of noComments.matchAll(/<(?:img|script|iframe|source|video|audio|embed)\b[^>]*\ssrc\s*=\s*["'](http:\/\/[^"']+)["']/gi)) mixed.push(m[1]);
    for (const l of sheets) if (/^http:\/\//i.test(l.href)) mixed.push(l.href);
  }

  const first = anchors.slice(0, 6);
  const text = strip(body);
  return {
    title: strip(clean.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''),
    description: (meta('description') || '').trim(),
    canonical: canonical ? abs(canonical, finalUrl) : '',
    lang: (html.match(/<html[^>]*\slang\s*=\s*["']([^"']+)["']/i)?.[1] ?? '').trim(),
    viewport: meta('viewport'),
    robotsMeta: meta('robots').toLowerCase(),
    favicon: icon ? abs(icon, finalUrl) : '',
    og, twitter, jsonLd: ldJson, hreflang: links.filter((l) => rel(l, 'alternate') && l.hreflang).length,
    headings,
    nav: navText,
    buttons: uniq([...btns, ...submitInputs].filter((t) => t && t.length < 50)).slice(0, 20),
    unnamedButtons: btns.filter((b) => !b).length,
    forms: (body.match(/<form[\s>]/gi) ?? []).length,
    controls: { total, unlabelled },
    images: { total: imgTotal, missingAlt, noDimensions: noDims, lazy },
    links: { internal: uniq(internal), externalHosts: uniq(externalHosts), unnamed: anchors.filter((a) => a.hasHref && !a.text).length, total: anchors.length },
    scripts: { external: extScripts, inline: inlineScripts, blocking, thirdPartyHosts: uniq(thirdScripts) },
    styles: { external: sheets.length, inline: (noComments.match(/<style\b/gi) ?? []).length, thirdPartyHosts: uniq(thirdStyles) },
    landmarks: { main: /<main\b|role\s*=\s*["']main["']/i.test(body), nav: /<nav\b|role\s*=\s*["']navigation["']/i.test(body), header: /<header\b|role\s*=\s*["']banner["']/i.test(body), footer: /<footer\b|role\s*=\s*["']contentinfo["']/i.test(body) },
    skipLink: first.some((a) => /^#/.test(a.href.trim()) && /skip/i.test(a.text)),
    words: text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length,
    mixedContent: uniq(mixed).slice(0, 5),
    iframes: (body.match(/<iframe\b/gi) ?? []).length,
    bytes: Buffer.byteLength(html),
  };
}
