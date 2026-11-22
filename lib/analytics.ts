/** First-party, cookieless analytics: event validation and aggregation (pure functions). No IPs, cookies or visitor IDs are stored. */
export type Device = 'mobile' | 'tablet' | 'desktop';
export interface EventRow { type: 'view' | 'vitals'; path: string; referrer_host: string | null; device: Device | null; lcp_ms: number | null; cls: number | null; ttfb_ms: number | null }

const PATH = /^\/[A-Za-z0-9\-._~\/%]*$/;
const num = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);

export function parseEvent(input: unknown, ownHost: string): EventRow | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  if (o.t !== 'view' && o.t !== 'vitals') return null;
  if (typeof o.path !== 'string') return null;
  const path = o.path.split(/[?#]/)[0];
  if (path.length > 200 || !PATH.test(path) || /^\/(admin|api)(\/|$)/.test(path)) return null; // never record the control centre
  let referrer_host: string | null = null;
  if (typeof o.ref === 'string' && o.ref) {
    try {
      const h = new URL(o.ref).hostname.slice(0, 100);
      referrer_host = h && h !== ownHost ? h : null;
    } catch { /* ignore */ }
  }
  const w = num(o.w, 1, 20000);
  const device: Device | null = w === null ? null : w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
  if (o.t === 'view') return { type: 'view', path, referrer_host, device, lcp_ms: null, cls: null, ttfb_ms: null };
  const lcp = num(o.lcp, 0, 120000), ttfb = num(o.ttfb, 0, 120000), cls = num(o.cls, 0, 10);
  if (lcp === null && ttfb === null && cls === null) return null;
  return { type: 'vitals', path, referrer_host: null, device, lcp_ms: lcp === null ? null : Math.round(lcp), cls, ttfb_ms: ttfb === null ? null : Math.round(ttfb) };
}

export const p75 = (v: number[]): number | null => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.75 * s.length) - 1)];
};

export interface Summary {
  views: number;
  daily: { day: string; views: number }[];
  pages: { key: string; views: number }[];
  referrers: { key: string; views: number }[];
  devices: { key: string; views: number }[];
  vitals: { lcp: number | null; ttfb: number | null; cls: number | null; samples: number };
}
const top = (m: Map<string, number>, n = 8) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([key, views]) => ({ key, views }));
const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

export function summarise(rows: (EventRow & { created_at: string })[], days: number, now = new Date()): Summary {
  const byDay = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) byDay.set(new Date(now.getTime() - i * 864e5).toISOString().slice(0, 10), 0);
  const pages = new Map<string, number>(), refs = new Map<string, number>(), devs = new Map<string, number>();
  const lcp: number[] = [], ttfb: number[] = [], cls: number[] = [];
  let views = 0, samples = 0;
  for (const r of rows) {
    if (r.type === 'view') {
      const day = r.created_at.slice(0, 10);
      if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + 1);
      views++;
      bump(pages, r.path);
      if (r.referrer_host) bump(refs, r.referrer_host);
      if (r.device) bump(devs, r.device);
    } else {
      samples++;
      if (r.lcp_ms !== null) lcp.push(r.lcp_ms);
      if (r.ttfb_ms !== null) ttfb.push(r.ttfb_ms);
      if (r.cls !== null) cls.push(Number(r.cls));
    }
  }
  return { views, daily: [...byDay].map(([day, v]) => ({ day, views: v })), pages: top(pages), referrers: top(refs), devices: top(devs), vitals: { lcp: p75(lcp), ttfb: p75(ttfb), cls: p75(cls), samples } };
}
