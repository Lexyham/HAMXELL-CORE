import type { HotDoc, HotStore } from './archiver';

/** Postgres tables that are archived to TiDB. Only these names are ever read or deleted through this adapter. */
export const SUPABASE_COLLECTIONS = ['documentation_versions', 'activity_logs'] as const;
export const isSupabaseCollection = (c: string) => (SUPABASE_COLLECTIONS as readonly string[]).includes(c);

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = { from(t: string): any; rpc(fn: string, args: Record<string, unknown>): any };

/**
 * Hot store over Supabase for the tables that live in Postgres. Rows older than the cutoff are read oldest first. Deletion goes through
 * the database: plain deletes for versions, and the guarded purge function for the append-only activity log.
 */
export function supabaseHotStore(sb: () => Sb): HotStore {
  const guard = (c: string) => { if (!isSupabaseCollection(c)) throw new Error(`"${c}" is not an archivable table.`); };
  return {
    async fetchOld(collection, cutoff, limit) {
      guard(collection);
      const { data, error } = await sb().from(collection).select('*').lt('created_at', cutoff.toISOString()).order('id', { ascending: true }).limit(limit);
      if (error) throw new Error(error.message);
      return ((data ?? []) as any[]).map((r): HotDoc => ({ ...r, _id: r.id, createdAt: new Date(r.created_at) }));
    },
    async deleteByIds(collection, ids) {
      guard(collection);
      if (collection === 'activity_logs') {
        const { data, error } = await sb().rpc('purge_archived_activity_logs', { ids });
        if (error) throw new Error(error.message);
        return Number(data ?? 0);
      }
      const { data, error } = await sb().from(collection).delete().in('id', ids).select('id');
      if (error) throw new Error(error.message);
      return (data ?? []).length;
    },
  };
}
