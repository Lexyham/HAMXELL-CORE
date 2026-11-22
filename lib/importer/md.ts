/** Helpers for writing untrusted text (taken from a website being audited) safely into Markdown. */

/** Evidence in a code span: no links, bold or table breakage can come from the audited site's own text. */
export function code(s: string, max = 120): string {
  const one = String(s).replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/`/g, "'").replace(/\|/g, '\u00a6').replace(/\s+/g, ' ').trim();
  const cut = one.length > max ? `${one.slice(0, max - 1)}\u2026` : one;
  return `\`${cut || '(empty)'}\``;
}

/** A single-line, pipe-free table cell. */
export const cell = (s: string): string => String(s).replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\u00a6').trim();

export const n = (x: number): string => x.toLocaleString('en-GB');
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
/** Numbers up to twelve are written out in prose, as in formal reports; larger numbers stay as figures. */
export const spell = (x: number): string => (Number.isInteger(x) && x >= 0 && x <= 12 ? WORDS[x] : n(x));
export const kb = (bytes: number): string => (bytes < 1024 ? 'under 1 KB' : `${n(Math.round(bytes / 1024))} KB`);
export const be = (count: number): string => (count === 1 ? 'was' : 'were');
export const pl = (count: number, word: string, plural = `${word}s`): string => `${n(count)} ${count === 1 ? word : plural}`;
export function and(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
/** Path part of an address, for compact tables. */
export const path = (u: string): string => { try { const x = new URL(u); return `${x.pathname || '/'}${x.search}`; } catch { return u; } };
