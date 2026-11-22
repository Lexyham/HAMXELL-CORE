import 'server-only';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

const UA = process.env.CRAWLER_USER_AGENT ?? 'HAMXELL-CORE-Importer/1.0';
const TIMEOUT_MS = Number(process.env.CRAWLER_TIMEOUT_MS ?? 10000);
const MAX_BYTES = Number(process.env.CRAWLER_MAX_BYTES ?? 5242880);
const BLOCK_PRIVATE = process.env.CRAWLER_BLOCK_PRIVATE_IPS !== 'false';

export class CrawlError extends Error {}

/** True for loopback, RFC1918, CGNAT, link-local (incl. 169.254.169.254 metadata), multicast, reserved and unspecified. */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b, c] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::' || v === '::1') return true;
    if (v.startsWith('::ffff:')) {
      const tail = v.slice(7);
      return net.isIPv4(tail) ? isPrivateIp(tail) : true;
    }
    return /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith('ff');
  }
  return true;
}

/** Validates every address at connect time, so DNS rebinding between check and connect cannot reach a private host. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeLookup(hostname: string, options: dns.LookupOptions, cb: (...args: any[]) => void) {
  dns.lookup(hostname, { ...options, all: true }, (err, addrs) => {
    if (err) return cb(err);
    const list = addrs as dns.LookupAddress[];
    if (BLOCK_PRIVATE && list.some((a) => isPrivateIp(a.address))) {
      return cb(new CrawlError('Target resolves to a non-public address.'));
    }
    if (options.all) return cb(null, list);
    cb(null, list[0].address, list[0].family);
  });
}

export function parseTarget(input: string): URL {
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    throw new CrawlError('Not a valid URL.');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new CrawlError('Only http(s) URLs are allowed.');
  if (u.username || u.password) throw new CrawlError('URLs with credentials are not allowed.');
  if (u.port && u.port !== '80' && u.port !== '443') throw new CrawlError('Only standard ports are allowed.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (BLOCK_PRIVATE && (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || (net.isIP(host) && isPrivateIp(host)))) {
    throw new CrawlError('Target is not a public address.');
  }
  return u;
}

export interface Fetched {
  url: string;
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
  truncated: boolean;
}

export interface FetchOpts { headersOnly?: boolean; acceptEncoding?: string; accept?: string }

function once(url: URL, o: FetchOpts = {}): Promise<Omit<Fetched, 'url'>> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = lib.request(url, {
      method: 'GET',
      lookup: safeLookup as any,
      headers: { 'user-agent': UA, accept: o.accept ?? 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5', 'accept-encoding': o.acceptEncoding ?? 'identity' },
    }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      let truncated = false;
      const finish = () => {
        clearTimeout(timer);
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8'), truncated });
      };
      if (o.headersOnly) { finish(); res.destroy(); return; } // status and headers are enough for link and compression probes
      res.on('data', (c: Buffer) => {
        size += c.length;
        if (size > MAX_BYTES) {
          truncated = true;
          res.destroy();
          return;
        }
        chunks.push(c);
      });
      res.on('end', finish);
      res.on('close', finish);
      res.on('error', () => finish());
    });
    const timer = setTimeout(() => req.destroy(new CrawlError('Request timed out.')), TIMEOUT_MS);
    req.on('error', (e) => {
      clearTimeout(timer);
      reject(e instanceof CrawlError ? e : new CrawlError(`Could not fetch the page (${(e as NodeJS.ErrnoException).code ?? e.message}).`));
    });
    req.end();
  });
}

/** GET with manual redirect handling (each hop re-validated), 10s timeout, 5MB cap, no decompression. */
export async function fetchSafe(input: string, maxRedirects = 4, o: FetchOpts = {}): Promise<Fetched> {
  let url = parseTarget(input);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await once(url, o);
    const loc = res.headers.location;
    if (res.status >= 300 && res.status < 400 && loc) {
      url = parseTarget(new URL(loc, url).toString());
      continue;
    }
    return { ...res, url: url.toString() };
  }
  throw new CrawlError('Too many redirects.');
}

/** Minimal robots.txt check (longest matching rule wins; Allow beats Disallow on ties). Fails open if robots.txt is unavailable. */
export function robotsAllows(body: string, path: string, agent?: string): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; pattern: string }[] }[] = [];
  let cur: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) groups.push((cur = { agents: [], rules: [] }));
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else if ((key === 'allow' || key === 'disallow') && cur) {
      if (val) cur.rules.push({ allow: key === 'allow', pattern: val });
      lastWasAgent = false;
    } else lastWasAgent = false;
  }
  const me = (agent ?? UA.split('/')[0]).toLowerCase();
  const group = groups.find((g) => g.agents.some((a) => a !== '*' && me.includes(a))) ?? groups.find((g) => g.agents.includes('*'));
  if (!group) return true;
  let best: { allow: boolean; len: number } | null = null;
  for (const r of group.rules) {
    const re = new RegExp('^' + r.pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    if (re.test(path) && (!best || r.pattern.length > best.len || (r.pattern.length === best.len && r.allow))) {
      best = { allow: r.allow, len: r.pattern.length };
    }
  }
  return best ? best.allow : true;
}

/** Sitemap URLs declared in robots.txt. */
export function robotsSitemaps(body: string): string[] {
  return [...body.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((m) => m[1]).slice(0, 5);
}
