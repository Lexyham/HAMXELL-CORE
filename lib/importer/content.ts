import { attrs, strip } from './analyze';

/** What a page says, not how well it is built: the raw material for the written description. Untrusted text, always. */
export interface PageContent {
  url: string;
  title: string;
  description: string;
  headings: string[];
  excerpt: string[];
  ctas: string[];
  schemaTypes: string[];
}

const CTA = /\b(contact|get started|start|sign ?up|register|book|schedule|request|quote|demo|buy|order|subscribe|download|try|join|enquir|apply|talk to|get in touch|learn more|explore|view)\b/i;
const MAX_SRC = 400_000;
const uniq = <T,>(a: T[]) => Array.from(new Set(a));
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

function walkLd(node: unknown, types: string[], descs: string[], depth = 0) {
  if (depth > 4 || node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.slice(0, 20).forEach((n) => walkLd(n, types, descs, depth + 1)); return; }
  const o = node as Record<string, unknown>;
  const t = o['@type'];
  if (typeof t === 'string') types.push(t);
  else if (Array.isArray(t)) types.push(...t.filter((x): x is string => typeof x === 'string'));
  if (typeof o.description === 'string' && o.description.length >= 30 && o.description.length <= 400) descs.push(o.description.trim());
  if (o['@graph']) walkLd(o['@graph'], types, descs, depth + 1);
}

export function extractContent(html: string, url: string): PageContent {
  const src = html.slice(0, MAX_SRC).replace(/<!--[\s\S]*?-->/g, ' ');

  const schemaTypes: string[] = [], ldDescs: string[] = [];
  for (const m of src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/ld\+json/i.test(attrs(`<script ${m[1]}>`).type ?? '')) continue;
    try { walkLd(JSON.parse(m[2]), schemaTypes, ldDescs); } catch { /* malformed structured data is ignored */ }
  }

  const metas = Array.from(src.matchAll(/<meta\s[^>]*>/gi)).map((m) => attrs(m[0]));
  const meta = (k: string) => metas.find((m) => (m.name ?? m.property ?? '').toLowerCase() === k)?.content ?? '';

  const clean = src.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<head[\s>][\s\S]*?<\/head>/i, ' ');
  const main = clean.match(/<main\b[\s\S]*<\/main>/i)?.[0] ?? clean;
  const prose = main.replace(/<(nav|footer|aside)\b[\s\S]*?<\/\1>/gi, ' ');

  const headings = uniq(Array.from(prose.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)).map((m) => strip(m[1])).filter((t) => t && t.length <= 120)).slice(0, 14);

  const excerpt: string[] = [];
  let total = 0;
  for (const m of prose.matchAll(/<(p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const t = strip(m[2]);
    if (t.length < 40 || t.length > 320 || words(t) < 6 || excerpt.includes(t)) continue;
    if (total + t.length > 1400) break;
    excerpt.push(t); total += t.length;
    if (excerpt.length >= 8) break;
  }
  if (ldDescs.length && excerpt.length < 8) excerpt.unshift(strip(ldDescs[0]));

  const ctaPool = [
    ...Array.from(prose.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)).map((m) => strip(m[1])),
    ...Array.from(prose.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)).map((m) => strip(m[1])),
  ];
  const ctas = uniq(ctaPool.filter((t) => t && t.length < 40 && CTA.test(t))).slice(0, 8);

  return {
    url,
    title: strip(clean.length ? (src.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '') : ''),
    description: (meta('description') || meta('og:description')).trim().slice(0, 400),
    headings, excerpt, ctas,
    schemaTypes: uniq(schemaTypes).slice(0, 8),
  };
}
