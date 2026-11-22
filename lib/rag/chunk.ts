export interface Chunk {
  id: string;
  title: string;
  url: string;
  text: string;
  kind: 'product' | 'doc' | 'project' | 'infra' | 'deployment' | 'domain';
}

const sentences = (s: string) => s.split(/(?<=[.!?])\s+/);

/** Splits Markdown into chunks of at most `max` characters, never cutting a code block, and prefixing each chunk with its nearest heading. */
export function chunkMarkdown(md: string, max = 900): string[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const blocks: { text: string; heading: string }[] = [];
  let heading = '', buf: string[] = [], fence = false;
  const flush = () => { const t = buf.join('\n').trim(); if (t) blocks.push({ text: t, heading }); buf = []; };
  for (const l of lines) {
    if (/^\s*```/.test(l)) { fence = !fence; buf.push(l); if (!fence) flush(); continue; }
    if (fence) { buf.push(l); continue; }
    const h = l.match(/^#{1,6}\s+(.*)$/);
    if (h) { flush(); heading = h[1].trim(); continue; }
    if (!l.trim()) { flush(); continue; }
    buf.push(l);
  }
  flush();

  const out: string[] = [];
  let cur = '', curHeading = '';
  const push = () => { if (cur.trim()) out.push(cur.trim()); cur = ''; };
  const prefix = (h: string) => (h ? `${h}\n` : '');
  for (const b of blocks) {
    const pieces: string[] = [];
    if (b.text.length <= max) pieces.push(b.text);
    else {
      let acc = '';
      for (const s of sentences(b.text)) {
        if ((acc + ' ' + s).length > max && acc) { pieces.push(acc); acc = ''; }
        acc = acc ? `${acc} ${s}` : s;
        while (acc.length > max) { pieces.push(acc.slice(0, max)); acc = acc.slice(max); } // unbroken long text
      }
      if (acc) pieces.push(acc);
    }
    for (const p of pieces) {
      if (b.heading !== curHeading || (cur + '\n\n' + p).length > max) { push(); curHeading = b.heading; cur = prefix(b.heading); }
      cur += (cur && !cur.endsWith('\n') ? '\n\n' : '') + p;
    }
  }
  push();
  return out;
}
