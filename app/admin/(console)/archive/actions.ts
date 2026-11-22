'use server';

import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { requireOwner } from '@/lib/auth';
import { enqueue } from '@/lib/db/queue';
import { archiveNow } from '@/lib/db/run';
import { mongoConfigured, pingMongo } from '@/lib/db/mongo';
import { supabaseConfigured } from '@/lib/supabase/config';
import { redisConfigured, getRedis } from '@/lib/db/redis';
import { CLUSTER_IDS, clusterConfigured } from '@/lib/db/routing';
import { pingTidb } from '@/lib/db/tidb';

const within = <T,>(p: Promise<T>, ms = 6000) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timed out')), ms))]);
const go = (q: Record<string, string>): never => redirect(`/admin/archive?${new URLSearchParams(q)}`);

export async function testConnections() {
  const { user, email } = await requireOwner();
  const checks: [string, boolean, () => Promise<unknown>][] = [
    ['MongoDB', mongoConfigured(), pingMongo],
    ['Redis', redisConfigured(), async () => { await getRedis()!.ping(); }],
    ...CLUSTER_IDS.map((id) => [`TiDB ${id}`, clusterConfigured(id), () => pingTidb(id)] as [string, boolean, () => Promise<unknown>]),
  ];
  const out = await Promise.all(checks.map(async ([name, on, fn]) => {
    if (!on) return `${name}: not configured`;
    try { await within(fn()); return `${name}: ok`; } catch (e) { return `${name}: FAILED (${(e as Error).message.slice(0, 80)})`; }
  }));
  await logActivity({ actorId: user.id, actorEmail: email, action: 'archive.test_connections' });
  go({ test: out.join('\n') });
}

export async function runArchiveNow() {
  const { user, email } = await requireOwner();
  if (!mongoConfigured() && !supabaseConfigured()) go({ error: 'Neither MongoDB nor Supabase is configured, so there is nothing to archive.' });
  await logActivity({ actorId: user.id, actorEmail: email, action: 'archive.run_requested' });
  try {
    if (await enqueue({ type: 'archive', requestedBy: email })) go({ ok: 'Queued. The worker process will run it shortly (npm run worker must be running).' });
  } catch { /* fall through to an inline run */ }
  // No Redis: run a bounded pass inline (2 batches per collection). The worker does full passes on its timer.
  const r = await archiveNow(`admin:${email}`, { maxBatches: 2 });
  if (r.locked) go({ error: 'An archive run is already in progress.' });
  const moved = r.results.reduce((n, x) => n + x.moved, 0);
  const problems = r.results.filter((x) => x.error || x.skipped).length;
  go({ ok: `Archived ${moved} documents.${problems ? ` ${problems} collection(s) need attention, see the latest run below.` : ''}` });
}
