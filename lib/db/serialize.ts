import { createHash } from 'node:crypto';

/** JSON-safe form of a Mongo document that keeps ObjectId and Date information, so nothing is lost in the archive. */
export function toJsonValue(v: unknown): unknown {
  if (v === undefined) return undefined;
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v instanceof Date) return { $date: v.toISOString() };
  if (typeof v === 'bigint') return { $numberLong: v.toString() };
  if (Array.isArray(v)) return v.map((x) => toJsonValue(x) ?? null);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (o._bsontype === 'ObjectId' || o._bsontype === 'ObjectID') return { $oid: String(v) };
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(o)) {
      const j = toJsonValue(x);
      if (j !== undefined) out[k] = j;
    }
    return out;
  }
  return String(v);
}

/** Deterministic JSON (sorted keys), so a document hashes identically before and after TiDB normalises its JSON column. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`;
}

export const checksumOf = (doc: unknown) => createHash('sha256').update(stableStringify(doc)).digest('hex');
