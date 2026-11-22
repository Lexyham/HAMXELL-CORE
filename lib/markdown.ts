/**
 * Small, dependency-free Markdown engine shared by the server (reader, HTML export), the browser (live editor preview)
 * and the PDF exporter. Safe by construction: raw HTML in the source is never passed through (everything is escaped),
 * links are restricted to http(s), mailto, same-site paths and anchors, and images are not rendered.
 */
export type Block =
  | { t: 'h'; level: number; text: string }
  | { t: 'p'; text: string }
  | { t: 'list'; ordered: boolean; items: Block[][] }
  | { t: 'code'; text: string }
  | { t: 'hr' }
  | { t: 'quote'; blocks: Block[] }
  | { t: 'table'; head: string[]; rows: string[][] };

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function safeHref(u: string): string | null {
  const t = u.trim();
  if (/[\u0000-\u0020\u007f]/.test(t)) return null;
  if (/^https?:\/\//i.test(t)) {
    try {
      new URL(t);
      return t;
    } catch {
      return null;
    }
  }
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(t)) return t;
  if (/^\/(?!\/)/.test(t) || /^#[\w-]*$/.test(t)) return t;
  return null;
}

const INLINE = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|(?<![A-Za-z0-9])_([^_\s][^_]*)_(?![A-Za-z0-9])/g;

export function inlineHtml(s: string): string {
  let out = '';
  let last = 0;
  for (const m of s.matchAll(INLINE)) {
    out += esc(s.slice(last, m.index));
    last = (m.index ?? 0) + m[0].length;
    if (m[1] !== undefined) out += `<code>${esc(m[1])}</code>`;
    else if (m[2] !== undefined) {
      const href = safeHref(m[3]);
      const inner = inlineHtml(m[2]);
      out += href ? `<a href="${esc(href)}"${/^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${inner}</a>` : inner;
    } else if (m[4] !== undefined || m[5] !== undefined) out += `<strong>${inlineHtml(m[4] ?? m[5])}</strong>`;
    else out += `<em>${inlineHtml(m[6] ?? m[7])}</em>`;
  }
  return out + esc(s.slice(last));
}

/** Plain-text form of inline Markdown (used by the PDF exporter). */
export function inlineText(s: string): string {
  return s
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, t, u) => (safeHref(u) && /^https?:/i.test(u) ? `${t} (${u})` : t))
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_m, a, b) => a ?? b)
    .replace(/\*([^*\s][^*]*)\*/g, '$1');
}

const LIST = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const FENCE = /^\s*```/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const HR = /^\s*([-*_])(\s*\1){2,}\s*$/;
const TABLE_SEP = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const startsBlock = (l: string, next?: string) =>
  FENCE.test(l) || HEADING.test(l) || HR.test(l) || /^\s*>/.test(l) || LIST.test(l) || (l.includes('|') && next !== undefined && TABLE_SEP.test(next));

export function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (FENCE.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push({ t: 'code', text: buf.join('\n') });
      continue;
    }
    const h = line.match(HEADING);
    if (h) { out.push({ t: 'h', level: h[1].length, text: h[2] }); i++; continue; }
    if (HR.test(line)) { out.push({ t: 'hr' }); i++; continue; }

    if (/^\s*>/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push({ t: 'quote', blocks: parseBlocks(buf.join('\n')) });
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(cells(lines[i++]));
      out.push({ t: 'table', head, rows });
      continue;
    }
    const lm = line.match(LIST);
    if (lm) {
      const base = lm[1].length;
      const ordered = /\d/.test(lm[2]);
      const items: string[][] = [];
      while (i < lines.length) {
        const l = lines[i];
        const m = l.match(LIST);
        if (m && m[1].length <= base + 1) { items.push([m[3]]); i++; continue; }
        if (!l.trim()) {
          const nxt = lines.slice(i + 1).find((x) => x.trim());
          if (nxt && (LIST.test(nxt) || /^\s{2,}\S/.test(nxt)) && (nxt.match(/^\s*/)![0].length > base || LIST.test(nxt))) { i++; continue; }
          break;
        }
        if (/^\s{2,}\S/.test(l) && items.length) { items[items.length - 1].push(l); i++; continue; }
        break;
      }
      out.push({
        t: 'list',
        ordered,
        items: items.map(([first, ...rest]) => {
          const pad = rest.length ? Math.min(...rest.map((r) => r.match(/^\s*/)![0].length)) : 0;
          return parseBlocks([first, ...rest.map((r) => r.slice(pad))].join('\n'));
        }),
      });
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !(buf.length && startsBlock(lines[i], lines[i + 1]))) buf.push(lines[i++].trim());
    out.push({ t: 'p', text: buf.join(' ') });
  }
  return out;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export function blocksToHtml(blocks: Block[], ids = new Map<string, number>()): string {
  return blocks
    .map((b) => {
      switch (b.t) {
        case 'h': {
          const plain = inlineText(b.text);
          const base = slug(plain) || 'section';
          const n = ids.get(base) ?? 0;
          ids.set(base, n + 1);
          return `<h${b.level} id="${esc(n ? `${base}-${n}` : base)}">${inlineHtml(b.text)}</h${b.level}>`;
        }
        case 'p': return `<p>${inlineHtml(b.text)}</p>`;
        case 'code': return `<pre><code>${esc(b.text)}</code></pre>`;
        case 'hr': return '<hr>';
        case 'quote': return `<blockquote>${blocksToHtml(b.blocks, ids)}</blockquote>`;
        case 'list': {
          const tag = b.ordered ? 'ol' : 'ul';
          return `<${tag}>${b.items.map((it) => `<li>${blocksToHtml(it, ids).replace(/^<p>([\s\S]*?)<\/p>/, '$1')}</li>`).join('')}</${tag}>`;
        }
        case 'table':
          return `<div class="table-wrap"><table><thead><tr>${b.head.map((c) => `<th>${inlineHtml(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${inlineHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      }
    })
    .join('\n');
}

export const renderMarkdown = (md: string) => blocksToHtml(parseBlocks(md));
