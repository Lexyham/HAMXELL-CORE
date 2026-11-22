import { getRedis, newBlockingRedis } from './redis';

export type Job = { type: 'archive'; requestedBy?: string };
const KEY = 'hxc:queue';

export async function enqueue(job: Job): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  await r.rpush(KEY, JSON.stringify(job));
  return true;
}

/** Blocking pop on a dedicated connection. Delivery is at-most-once: a job lost to a crash is simply re-requested; archiving is idempotent. */
export function makeConsumer() {
  const c = newBlockingRedis();
  return {
    available: Boolean(c),
    async next(timeoutSeconds: number): Promise<Job | null> {
      if (!c) return null;
      const r = await c.blpop(KEY, timeoutSeconds);
      if (!r) return null;
      try { return JSON.parse(r[1]) as Job; } catch { return null; }
    },
    close: () => c?.quit(),
  };
}
