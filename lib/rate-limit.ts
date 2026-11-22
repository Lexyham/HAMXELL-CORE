import 'server-only';
import { getRedis } from './db/redis';

/**
 * Rate limiting shared across server instances through Redis (fixed window per key, atomic, always has a TTL).
 * When REDIS_URL is unset or Redis errors, it falls back to a per-instance in-memory window rather than failing open.
 */
const hits = new Map<string, number[]>();

// Keep the fallback map bounded: drop idle keys once it grows.
function prune() {
  if (hits.size < 5000) return;
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [k, v] of hits) if (!v.length || v[v.length - 1] < cutoff) hits.delete(k);
}
const memRecent = (key: string, windowMs: number) => {
  const now = Date.now();
  return (hits.get(key) ?? []).filter((t) => now - t < windowMs);
};
function memHit(key: string, windowMs: number): number {
  prune();
  const recent = memRecent(key, windowMs);
  recent.push(Date.now());
  hits.set(key, recent);
  return recent.length;
}

async function redisHit(key: string, windowMs: number): Promise<number | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const k = `rl:${key}`;
    await r.set(k, 0, 'PX', windowMs, 'NX'); // creates the key with its TTL only if absent
    return await r.incr(k);
  } catch {
    return null;
  }
}

/** Counts this call; true while the caller is within `max` calls per window. */
export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const n = (await redisHit(key, windowMs)) ?? memHit(key, windowMs);
  return n <= max;
}

/** True when `key` has already recorded `max` events in the window. Does not record anything. */
export async function isLimited(key: string, max: number, windowMs: number): Promise<boolean> {
  const r = getRedis();
  if (r) {
    try {
      return Number((await r.get(`rl:${key}`)) ?? 0) >= max;
    } catch { /* fall through */ }
  }
  return memRecent(key, windowMs).length >= max;
}

/** Record one event (for example a failed attempt) against `key`. */
export async function recordHit(key: string, windowMs = 15 * 60 * 1000): Promise<void> {
  if ((await redisHit(key, windowMs)) === null) memHit(key, windowMs);
}
