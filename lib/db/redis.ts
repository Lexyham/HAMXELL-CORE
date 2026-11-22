import Redis from 'ioredis';

export const redisConfigured = () => Boolean(process.env.REDIS_URL);

const g = globalThis as unknown as { __hxcRedis?: Redis; __hxcRedisOverride?: unknown };

/** Shared connection for rate limits, locks and caching. Returns null when Redis is not configured. */
export function getRedis(): Redis | null {
  if (g.__hxcRedisOverride) return g.__hxcRedisOverride as Redis; // tests only
  if (!redisConfigured()) return null;
  if (!g.__hxcRedis) {
    g.__hxcRedis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 1, connectTimeout: 5000, enableOfflineQueue: false, lazyConnect: false });
    g.__hxcRedis.on('error', (e) => console.error('redis error:', e.message));
  }
  return g.__hxcRedis;
}
export const setRedisForTests = (c: unknown) => { g.__hxcRedisOverride = c; };

/** A separate connection for blocking pops, which would otherwise stall the shared one. */
export function newBlockingRedis(): Redis | null {
  return redisConfigured() ? new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null }) : null;
}

/** Cache-aside helper. Falls through to `fn` when Redis is absent or failing. */
export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const r = getRedis();
  if (r) {
    try {
      const hit = await r.get(`cache:${key}`);
      if (hit) return JSON.parse(hit) as T;
    } catch { /* fall through */ }
  }
  const value = await fn();
  if (r) { try { await r.set(`cache:${key}`, JSON.stringify(value), 'EX', ttlSeconds); } catch { /* ignore */ } }
  return value;
}

/** Best-effort distributed lock. Without Redis it only guards within one process. */
const local = new Set<string>();
export async function withLock<T>(name: string, ttlMs: number, fn: () => Promise<T>): Promise<{ ran: true; value: T } | { ran: false }> {
  const r = getRedis();
  const token = `${process.pid}:${Date.now()}:${Math.random()}`;
  const key = `lock:${name}`;
  if (r) {
    try {
      if ((await r.set(key, token, 'PX', ttlMs, 'NX')) !== 'OK') return { ran: false };
    } catch { return { ran: false }; }
    try {
      return { ran: true, value: await fn() };
    } finally {
      try { if ((await r.get(key)) === token) await r.del(key); } catch { /* lock expires on its own */ }
    }
  }
  if (local.has(key)) return { ran: false };
  local.add(key);
  try { return { ran: true, value: await fn() }; } finally { local.delete(key); }
}
