/** Which TiDB cold-archive cluster each hot collection is archived into (spec section 9.3). */
export type ClusterId = 'A' | 'B' | 'C' | 'D' | 'E';
export const CLUSTER_IDS: ClusterId[] = ['A', 'B', 'C', 'D', 'E'];

export const ROUTES = {
  analytics_events: 'A', // old analytics events
  chatbot_logs: 'B', // old chatbot conversations
  importer_jobs: 'C', // importer job history
  crawler_snapshots: 'C', // raw crawls
  raw_ai_responses: 'C', // raw AI responses (not named in the spec; grouped with the other raw data)
  documentation_versions: 'D', // older versions of documentation (Postgres table)
  activity_logs: 'E', // old activity log entries (Postgres table, append-only; purged only after verified archiving)
} as const satisfies Record<string, ClusterId>;

export type HotCollection = keyof typeof ROUTES;
export const HOT_COLLECTIONS = Object.keys(ROUTES) as HotCollection[];
// Collections held in Postgres (documentation_versions, activity_logs) are archived through lib/db/supabase-hot.ts; the rest live in MongoDB.

export function clusterFor(collection: string): ClusterId {
  const c = (ROUTES as Record<string, ClusterId>)[collection];
  if (!c) throw new Error(`No archive cluster is configured for collection "${collection}".`);
  return c;
}

export const clusterEnv = (id: ClusterId) => ({
  host: process.env[`TIDB_CLUSTER_${id}_HOST`],
  user: process.env[`TIDB_CLUSTER_${id}_USER`],
  password: process.env[`TIDB_CLUSTER_${id}_PASS`],
  database: process.env[`TIDB_CLUSTER_${id}_DB`],
  port: Number(process.env.TIDB_PORT ?? 4000),
});
export const clusterConfigured = (id: ClusterId) => {
  const e = clusterEnv(id);
  return Boolean(e.host && e.user && e.password && e.database);
};
