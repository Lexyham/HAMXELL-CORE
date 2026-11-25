const STOP = new Set(('a an the of to in on for and or but with about this that these those it its i we us our my me you your do does did how what which who whom where when why is are was were be been being have has had any some can could would should will please tell give show hi hello hey thanks thank as at by from if so than then there their they them not no yes').split(' '));

function stem(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) return `${w.slice(0, -3)}y`;
  for (const suf of ['ing', 'ed', 'es', 's', 'ly']) if (w.endsWith(suf) && w.length - suf.length >= 3) return w.slice(0, -suf.length);
  return w;
}

/** Lower-case, Unicode-aware (keeps accented letters), stop words removed, light stemming. */
export const tokenize = (s: string): string[] =>
  s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 2 && !STOP.has(t)).map(stem);

export interface Doc { id: string; title: string; text: string }
export interface Hit { id: string; score: number; coverage: number }

/**
 * Okapi BM25 keyword ranking over a small in-memory corpus. Titles count double. This is lexical retrieval, not semantic:
 * a question must share words with the source. A result is returned only if it matches enough of the question's terms,
 * so unrelated questions retrieve nothing; the public chatbot may still supply a separate, non-citable overview context.
 */
export class Bm25 {
  private tf: Map<string, number>[] = [];
  private len: number[] = [];
  private df = new Map<string, number>();
  private avg = 0;
  readonly size: number;
  constructor(docs: Doc[], private k1 = 1.4, private b = 0.75) {
    this.size = docs.length;
    for (const d of docs) {
      const toks = [...tokenize(d.title), ...tokenize(d.title), ...tokenize(d.text)];
      const m = new Map<string, number>();
      for (const t of toks) m.set(t, (m.get(t) ?? 0) + 1);
      for (const t of m.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      this.tf.push(m);
      this.len.push(toks.length);
    }
    this.avg = this.len.reduce((a, c) => a + c, 0) / Math.max(1, docs.length);
    this.ids = docs.map((d) => d.id);
  }
  private ids: string[];

  search(query: string, k = 5, minCoverage = 0.34): Hit[] {
    const q = [...new Set(tokenize(query))];
    if (!q.length || !this.size) return [];
    const hits: Hit[] = [];
    for (let i = 0; i < this.size; i++) {
      let score = 0, matched = 0;
      for (const t of q) {
        const f = this.tf[i].get(t) ?? 0;
        if (!f) continue;
        matched++;
        const n = this.df.get(t) ?? 0;
        const idf = Math.log(1 + (this.size - n + 0.5) / (n + 0.5));
        score += (idf * f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * this.len[i]) / (this.avg || 1)));
      }
      const coverage = matched / q.length;
      if (matched && coverage >= minCoverage) hits.push({ id: this.ids[i], score, coverage });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, k);
  }
}
