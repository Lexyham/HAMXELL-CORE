import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import { inlineText, parseBlocks, type Block } from '../markdown';

const W = 595.28, H = 841.89, M = 56, TEXT_W = W - 2 * M;
const MAP: Record<string, string> = { '\u2019': "'", '\u2018': "'", '\u201c': '"', '\u201d': '"', '\u2013': '-', '\u2014': '-', '\u2026': '...', '\u2022': '-', '\u2192': '->', '\u00a0': ' ', '\u2212': '-' };

/** Dependency-light PDF export using the standard Helvetica/Courier fonts (WinAnsi); unsupported glyphs become "?". */
export async function markdownToPdf(opts: { title: string; project: string; md: string }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(opts.title);
  pdf.setProducer('HAMXELL CORE');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const supported = new Set(regular.getCharacterSet());

  const clean = (s: string) =>
    Array.from(s.replace(/\t/g, '    ').replace(/[\r\n]+/g, ' '))
      .map((ch) => MAP[ch] ?? (supported.has(ch.codePointAt(0)!) ? ch : '?'))
      .join('');

  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const ink = rgb(0.1, 0.11, 0.13), muted = rgb(0.4, 0.43, 0.47);

  const ensure = (need: number) => {
    if (y - need < M) { page = pdf.addPage([W, H]); y = H - M; }
  };

  function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const lines: string[] = [];
    let cur = '';
    for (const word of clean(text).split(' ')) {
      let w = word;
      while (font.widthOfTextAtSize(w, size) > width) { // hard-break very long tokens
        let n = w.length;
        while (n > 1 && font.widthOfTextAtSize(w.slice(0, n), size) > width) n--;
        if (cur) { lines.push(cur); cur = ''; }
        lines.push(w.slice(0, n));
        w = w.slice(n);
      }
      const test = cur ? `${cur} ${w}` : w;
      if (cur && font.widthOfTextAtSize(test, size) > width) { lines.push(cur); cur = w; } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  }

  function para(text: string, o: { font?: PDFFont; size?: number; indent?: number; color?: ReturnType<typeof rgb>; after?: number; bullet?: string; bg?: boolean }) {
    const font = o.font ?? regular, size = o.size ?? 10.5, indent = o.indent ?? 0, lh = size * 1.4;
    const lines = wrap(text, font, size, TEXT_W - indent);
    lines.forEach((l, i) => {
      ensure(lh);
      if (o.bg) page.drawRectangle({ x: M + indent - 4, y: y - lh + size * 0.35, width: TEXT_W - indent + 8, height: lh, color: rgb(0.95, 0.95, 0.96) });
      if (i === 0 && o.bullet) page.drawText(clean(o.bullet), { x: M + indent - 14, y: y - size, size, font, color: o.color ?? ink });
      page.drawText(l, { x: M + indent, y: y - size, size, font, color: o.color ?? ink });
      y -= lh;
    });
    y -= o.after ?? size * 0.6;
  }

  /**
   * Draws a table. Column widths are proportional to content but never narrower than the longest word in the column (so words are
   * not broken), a row never splits across pages, the header is kept with the first row, and it repeats on each new page.
   */
  function drawTable(head: string[], rows: string[][], indent: number) {
    const size = 8.5, lh = size * 1.35, pad = 4, avail = TEXT_W - indent, cols = head.length;
    const text = [head, ...rows].map((r) => Array.from({ length: cols }, (_, i) => clean(inlineText(r[i] ?? ''))));
    const longestWord = (i: number) => Math.max(...text.map((r, ri) => Math.max(...r[i].split(' ').map((w) => (ri === 0 ? bold : regular).widthOfTextAtSize(w, size)), 0))) + 2 * pad + 2;
    const minW = Array.from({ length: cols }, (_, i) => Math.min(longestWord(i), avail * 0.34));
    const weights = Array.from({ length: cols }, (_, i) => Math.min(Math.max(Math.sqrt(Math.max(...text.map((r) => r[i].length), 3)), 3), 13));
    const spare = Math.max(avail - minW.reduce((a, c) => a + c, 0), 0), wsum = weights.reduce((a, c) => a + c, 0);
    const widths = minW.map((m, i) => m + (spare * weights[i]) / wsum);
    const wrapped = text.map((r, ri) => r.map((t, i) => wrap(t, ri === 0 ? bold : regular, size, Math.max(widths[i] - 2 * pad, 12))));
    const heights = wrapped.map((w) => Math.max(...w.map((x) => x.length)) * lh + 2 * pad);

    const drawRow = (ri: number) => {
      const h = heights[ri], font = ri === 0 ? bold : regular;
      if (ri === 0) page.drawRectangle({ x: M + indent, y: y - h, width: avail, height: h, color: rgb(0.94, 0.95, 0.96) });
      let x = M + indent;
      wrapped[ri].forEach((lines, i) => {
        lines.forEach((l, li) => page.drawText(l, { x: x + pad, y: y - pad - size - li * lh + 2, size, font, color: ink }));
        x += widths[i];
      });
      page.drawLine({ start: { x: M + indent, y: y - h }, end: { x: M + indent + avail, y: y - h }, thickness: 0.4, color: rgb(0.78, 0.8, 0.83) });
      y -= h;
    };
    ensure(Math.min(heights[0] + (heights[1] ?? 0), H - 2 * M)); // header stays with its first row
    drawRow(0);
    for (let ri = 1; ri < text.length; ri++) {
      if (y - heights[ri] < M) { page = pdf.addPage([W, H]); y = H - M; drawRow(0); }
      drawRow(ri);
    }
    y -= 10;
  }

  function render(blocks: Block[], indent = 0) {
    for (const b of blocks) {
      if (b.t === 'h') {
        const size = [0, 18, 14, 12, 11, 11, 11][b.level];
        ensure(size * 3);
        y -= size * 0.5;
        para(inlineText(b.text), { font: bold, size, indent, after: size * 0.4 });
      } else if (b.t === 'p') para(inlineText(b.text), { indent });
      else if (b.t === 'code') b.text.split('\n').forEach((l, i, a) => para(l || ' ', { font: mono, size: 8.5, indent: indent + 6, bg: true, after: i === a.length - 1 ? 8 : 0 }));
      else if (b.t === 'hr') { ensure(14); page.drawLine({ start: { x: M, y: y - 4 }, end: { x: W - M, y: y - 4 }, thickness: 0.5, color: muted }); y -= 14; }
      else if (b.t === 'quote') render(b.blocks, indent + 16);
      else if (b.t === 'list') {
        b.items.forEach((item, n) => {
          const first = item[0];
          const lead = first?.t === 'p' ? first : null;
          para(lead ? inlineText(lead.text) : ' ', { indent: indent + 18, bullet: b.ordered ? `${n + 1}.` : '-', after: 3 });
          render(lead ? item.slice(1) : item, indent + 18);
        });
        y -= 4;
      } else if (b.t === 'table') drawTable(b.head, b.rows, indent);
    }
  }

  para(opts.title, { font: bold, size: 22, after: 4 });
  para(`${opts.project}  /  HAMXELL CORE`, { size: 9, color: muted, after: 14 });
  render(parseBlocks(opts.md));

  const pages = pdf.getPages();
  pages.forEach((p: PDFPage, i: number) => {
    p.drawText(clean(`HAMXELL CORE  /  ${opts.title}`).slice(0, 80), { x: M, y: 28, size: 8, font: regular, color: muted });
    const label = `${i + 1} / ${pages.length}`;
    p.drawText(label, { x: W - M - regular.widthOfTextAtSize(label, 8), y: 28, size: 8, font: regular, color: muted });
  });
  return pdf.save();
}
