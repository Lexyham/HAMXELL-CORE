import 'server-only';
import { renderMarkdown, esc } from '../markdown';
import { markdownToPdf } from './pdf';

export type ExportFormat = 'md' | 'html' | 'pdf';
export const parseFormat = (v: string | null): ExportFormat | null => (v === 'md' || v === 'html' || v === 'pdf' ? v : null);

export interface ExportDoc { title: string; project: string; slug: string; kind: string; md: string; updated?: string }

const CSS = `:root{color-scheme:light dark;--fg:#14161a;--bg:#fff;--mut:#5b616b;--line:#d9dce1;--soft:#f3f4f6;--acc:#2865f5}
@media(prefers-color-scheme:dark){:root{--fg:#f4f5f7;--bg:#08090c;--mut:#969da8;--line:#292e38;--soft:#101216}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.7 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:46rem;margin:0 auto;padding:2.5rem 1.25rem 4rem}header{border-bottom:1px solid var(--line);margin-bottom:2rem;padding-bottom:1rem}
header p{margin:0;font:12px/1.4 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
h1,h2,h3,h4{line-height:1.2;letter-spacing:-.02em;margin:1.8em 0 .5em}a{color:var(--fg);border-bottom:1px solid var(--acc);text-decoration:none}
code{font:.9em ui-monospace,Menlo,monospace;background:var(--soft);padding:.1em .35em}pre{overflow-x:auto;background:var(--soft);border:1px solid var(--line);padding:1rem}pre code{background:none;padding:0}
blockquote{border-left:2px solid var(--line);margin-left:0;padding-left:1rem;color:var(--mut)}.table-wrap{overflow-x:auto}table{border-collapse:collapse}th,td{border:1px solid var(--line);padding:.5rem .75rem;text-align:left}
hr{border:0;border-top:1px solid var(--line)}@media print{body{background:#fff;color:#000}a{border:0}}`;

export function htmlDocument(d: ExportDoc): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(d.title)} | ${esc(d.project)}</title><style>${CSS}</style></head><body><main><header><p>${esc(d.project)} / HAMXELL CORE</p></header>${renderMarkdown(d.md)}</main></body></html>`;
}

export async function exportResponse(format: ExportFormat, d: ExportDoc): Promise<Response> {
  const base = `${d.slug}-${d.kind}`.replace(/[^a-z0-9-]/gi, '-').slice(0, 80);
  const common = { 'Content-Disposition': `attachment; filename="${base}.${format}"`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' };
  if (format === 'md') return new Response(d.md, { headers: { ...common, 'Content-Type': 'text/markdown; charset=utf-8' } });
  if (format === 'html') {
    return new Response(htmlDocument(d), { headers: { ...common, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" } });
  }
  const bytes = await markdownToPdf({ title: d.title, project: d.project, md: d.md });
  return new Response(bytes as BodyInit, { headers: { ...common, 'Content-Type': 'application/pdf' } });
}
