import mysql, { type Pool } from 'mysql2/promise';
import type { ColdRow, ColdStore } from './archiver';
import { CLUSTER_IDS, clusterConfigured, clusterEnv, type ClusterId } from './routing';

const pools = new Map<ClusterId, Pool>();

function pool(id: ClusterId): Pool {
  let p = pools.get(id);
  if (!p) {
    const e = clusterEnv(id);
    p = mysql.createPool({
      host: e.host, port: e.port, user: e.user, password: e.password, database: e.database,
      ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }, // TiDB Cloud requires TLS
      connectionLimit: 3, connectTimeout: 10_000, dateStrings: false,
    });
    pools.set(id, p);
  }
  return p;
}

export const SCHEMA = `CREATE TABLE IF NOT EXISTS archived_documents (
  collection  VARCHAR(64)  NOT NULL,
  id          VARCHAR(64)  NOT NULL,
  created_at  DATETIME(3)  NOT NULL,
  archived_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  checksum    CHAR(64)     NOT NULL,
  doc         JSON         NOT NULL,
  PRIMARY KEY (collection, id),
  KEY idx_collection_created (collection, created_at)
)`;

export function tidbStore(id: ClusterId): ColdStore | null {
  if (!clusterConfigured(id)) return null;
  return {
    async insert(rows: ColdRow[]) {
      if (!rows.length) return;
      // Idempotent: re-archiving the same document after a partial failure must not error or duplicate.
      await pool(id).query(
        'INSERT INTO archived_documents (collection, id, created_at, checksum, doc) VALUES ? ON DUPLICATE KEY UPDATE checksum = VALUES(checksum), doc = VALUES(doc)',
        [rows.map((r) => [r.collection, r.id, r.createdAt, r.checksum, r.doc])],
      );
    },
    async read(collection, ids) {
      const out = new Map<string, unknown>();
      if (!ids.length) return out;
      const [rows] = await pool(id).query('SELECT id, doc FROM archived_documents WHERE collection = ? AND id IN (?)', [collection, ids]);
      for (const r of rows as { id: string; doc: unknown }[]) out.set(r.id, typeof r.doc === 'string' ? JSON.parse(r.doc) : r.doc);
      return out;
    },
  };
}

export const coldFor = (cluster: string) => (CLUSTER_IDS.includes(cluster as ClusterId) ? tidbStore(cluster as ClusterId) : null);

export async function applySchema(id: ClusterId) {
  await pool(id).query(SCHEMA);
}
export async function pingTidb(id: ClusterId) {
  await pool(id).query('SELECT 1');
}
