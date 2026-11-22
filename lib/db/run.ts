import { runArchive, type RunResult } from './archiver';
import type { HotStore } from './archiver';
import { getDb, mongoConfigured, mongoHotStore } from './mongo';
import { isSupabaseCollection, supabaseHotStore } from './supabase-hot';
import { plainServiceClient } from './supabase-plain';
import { withLock } from './redis';
import { clusterFor, HOT_COLLECTIONS } from './routing';
import { coldFor } from './tidb';

export interface ArchiveReport { startedAt: Date; finishedAt: Date; trigger: string; results: RunResult[]; locked?: boolean }

/** One full archive pass under a lock, recorded in `archive_runs`. Safe to call from the worker or the admin UI. */
export async function archiveNow(trigger: string, opts: { maxBatches?: number; log?: (m: string) => void } = {}): Promise<ArchiveReport> {
  const startedAt = new Date();
  const sbOn = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  // Each collection is archived only if its source database is configured.
  const collections = HOT_COLLECTIONS.filter((c) => (isSupabaseCollection(c) ? sbOn : mongoConfigured())).map((name) => ({ name, cluster: clusterFor(name) }));
  if (collections.length === 0) return { startedAt, finishedAt: new Date(), trigger, results: [], locked: false };
  const pg = supabaseHotStore(plainServiceClient);
  const hot: HotStore = {
    fetchOld: (c, cutoff, limit) => (isSupabaseCollection(c) ? pg : mongoHotStore).fetchOld(c, cutoff, limit),
    deleteByIds: (c, ids) => (isSupabaseCollection(c) ? pg : mongoHotStore).deleteByIds(c, ids),
  };
  const days = Number(process.env.ARCHIVE_AGE_DAYS ?? 30);
  const cutoff = new Date(Date.now() - days * 864e5);

  const res = await withLock('archive', 60 * 60 * 1000, () =>
    runArchive({ collections, hot, coldFor, cutoff, maxBatches: opts.maxBatches, log: opts.log }),
  );
  const report: ArchiveReport = { startedAt, finishedAt: new Date(), trigger, results: res.ran ? res.value : [], locked: !res.ran };
  if (res.ran && mongoConfigured()) {
    try {
      await (await getDb()).collection('archive_runs').insertOne({ ...report, createdAt: report.startedAt });
    } catch (e) { opts.log?.(`could not record archive run: ${(e as Error).message}`); }
  }
  return report;
}
