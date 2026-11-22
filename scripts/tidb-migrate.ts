// Applies db/tidb/schema.sql to every configured TiDB cluster. Run: npm run tidb:migrate
import { applySchema } from '../lib/db/tidb';
import { CLUSTER_IDS, clusterConfigured } from '../lib/db/routing';

(async () => {
  let failed = 0;
  for (const id of CLUSTER_IDS) {
    if (!clusterConfigured(id)) { console.log(`cluster ${id}: not configured, skipped`); continue; }
    try { await applySchema(id); console.log(`cluster ${id}: schema applied`); } catch (e) { failed++; console.error(`cluster ${id}: FAILED: ${(e as Error).message}`); }
  }
  process.exit(failed ? 1 : 0);
})();
