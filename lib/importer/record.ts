import { getDb, mongoConfigured } from '../db/mongo';

const KEEP = ['server', 'content-type', 'x-powered-by', 'content-length', 'last-modified', 'cache-control'];

/** Best-effort history in the hot store (MongoDB). Never throws: recording must not break an import. */
export async function recordImport(o: {
  url: string; status: 'done' | 'failed'; error?: string; ms: number; actorId?: string;
  page?: { url: string; status: number; headers: Record<string, unknown>; body: string };
}) {
  if (!mongoConfigured()) return;
  try {
    const db = await getDb();
    const createdAt = new Date();
    await db.collection('importer_jobs').insertOne({ url: o.url.slice(0, 500), status: o.status, error: o.error ?? null, ms: o.ms, actorId: o.actorId ?? null, createdAt });
    if (o.page) {
      const headers = Object.fromEntries(KEEP.filter((k) => o.page!.headers[k] !== undefined).map((k) => [k, String(o.page!.headers[k])]));
      await db.collection('crawler_snapshots').insertOne({ url: o.url.slice(0, 500), finalUrl: o.page.url, status: o.page.status, headers, body: o.page.body.slice(0, 200_000), createdAt });
    }
  } catch (e) {
    console.error('could not record import history', (e as Error).message);
  }
}
