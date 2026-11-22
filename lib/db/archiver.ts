import { checksumOf, toJsonValue } from './serialize';

export interface HotDoc { _id: unknown; createdAt: Date; [k: string]: unknown }
export interface ColdRow { id: string; collection: string; createdAt: Date; doc: string; checksum: string }

export interface HotStore {
  fetchOld(collection: string, cutoff: Date, limit: number): Promise<HotDoc[]>;
  deleteByIds(collection: string, ids: unknown[]): Promise<number>;
}
export interface ColdStore {
  insert(rows: ColdRow[]): Promise<void>;
  /** Reads the stored documents back, parsed. Used to confirm what the archive really holds. */
  read(collection: string, ids: string[]): Promise<Map<string, unknown>>;
}

export interface CollectionResult { collection: string; moved: number; error?: string }

/**
 * Safe-delete archiving of one collection. A hot document is deleted only after it has been written to the cold store,
 * read back, and its checksum matched. Any failure stops this collection and leaves everything not yet confirmed in place,
 * to be retried on the next run.
 */
export async function archiveCollection(o: {
  collection: string; hot: HotStore; cold: ColdStore; cutoff: Date; batchSize?: number; maxBatches?: number; log?: (m: string) => void;
}): Promise<CollectionResult> {
  const batchSize = o.batchSize ?? 500;
  const maxBatches = o.maxBatches ?? 100;
  const log = o.log ?? (() => {});
  let moved = 0;

  for (let b = 0; b < maxBatches; b++) {
    let docs: HotDoc[];
    try {
      docs = await o.hot.fetchOld(o.collection, o.cutoff, batchSize);
    } catch (e) {
      return { collection: o.collection, moved, error: `read from hot store failed: ${(e as Error).message}` };
    }
    if (docs.length === 0) break;

    const rows: (ColdRow & { hotId: unknown })[] = docs.map((d) => {
      const json = toJsonValue(d) as Record<string, unknown>;
      return { hotId: d._id, id: String(d._id), collection: o.collection, createdAt: d.createdAt, doc: JSON.stringify(json), checksum: checksumOf(json) };
    });

    try {
      await o.cold.insert(rows.map(({ hotId: _h, ...r }) => r));
    } catch (e) {
      log(`archive insert failed for ${o.collection}: ${(e as Error).message}`);
      return { collection: o.collection, moved, error: `insert into cold store failed: ${(e as Error).message}` };
    }

    let stored: Map<string, unknown>;
    try {
      stored = await o.cold.read(o.collection, rows.map((r) => r.id));
    } catch (e) {
      return { collection: o.collection, moved, error: `verification read failed: ${(e as Error).message}` };
    }
    const verified = rows.filter((r) => stored.has(r.id) && checksumOf(stored.get(r.id)) === r.checksum);

    if (verified.length > 0) {
      try {
        moved += await o.hot.deleteByIds(o.collection, verified.map((r) => r.hotId));
      } catch (e) {
        // The data is safely archived; the hot copies simply remain and are re-archived idempotently next run.
        return { collection: o.collection, moved, error: `delete from hot store failed: ${(e as Error).message}` };
      }
    }
    if (verified.length !== rows.length) {
      log(`verification mismatch in ${o.collection}: ${rows.length - verified.length} of ${rows.length} not confirmed`);
      return { collection: o.collection, moved, error: `${rows.length - verified.length} document(s) failed verification and were kept in the hot store` };
    }
    if (docs.length < batchSize) break;
  }
  return { collection: o.collection, moved };
}

export interface RunResult extends CollectionResult { cluster: string; skipped?: string }

/** Archives every routed collection; one failing collection or cluster never stops the others. */
export async function runArchive(o: {
  collections: { name: string; cluster: string }[];
  hot: HotStore;
  coldFor: (cluster: string) => ColdStore | null;
  cutoff: Date;
  maxBatches?: number;
  log?: (m: string) => void;
}): Promise<RunResult[]> {
  const out: RunResult[] = [];
  for (const { name, cluster } of o.collections) {
    const cold = o.coldFor(cluster);
    if (!cold) { out.push({ collection: name, cluster, moved: 0, skipped: `cluster ${cluster} is not configured` }); continue; }
    try {
      out.push({ ...(await archiveCollection({ collection: name, hot: o.hot, cold, cutoff: o.cutoff, maxBatches: o.maxBatches, log: o.log })), cluster });
    } catch (e) {
      out.push({ collection: name, cluster, moved: 0, error: (e as Error).message });
    }
  }
  return out;
}
