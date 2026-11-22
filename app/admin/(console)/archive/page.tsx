import { BTN, BTN_GHOST, Notice } from '@/components/admin/ui';
import { requireOwner } from '@/lib/auth';
import { getDb, mongoConfigured } from '@/lib/db/mongo';
import { isSupabaseCollection } from '@/lib/db/supabase-hot';
import { serviceClient } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/supabase/config';
import { redisConfigured } from '@/lib/db/redis';
import { CLUSTER_IDS, clusterConfigured, clusterFor, HOT_COLLECTIONS } from '@/lib/db/routing';
import { runArchiveNow, testConnections } from './actions';

export default async function ArchivePage({ searchParams }: { searchParams: { error?: string; ok?: string; test?: string } }) {
  await requireOwner();
  const days = Number(process.env.ARCHIVE_AGE_DAYS ?? 30);
  const cutoff = new Date(Date.now() - days * 864e5);

  let counts: { name: string; cluster: string; hot: number; eligible: number }[] = [];
  let runs: { _id: unknown; startedAt: Date; trigger: string; results: { collection: string; moved: number; error?: string; skipped?: string }[] }[] = [];
  let dbError = '';
  if (supabaseConfigured()) {
    try {
      const sb = serviceClient();
      for (const name of HOT_COLLECTIONS.filter(isSupabaseCollection)) {
        const all = await sb.from(name).select('id', { count: 'exact', head: true });
        const old = await sb.from(name).select('id', { count: 'exact', head: true }).lt('created_at', cutoff.toISOString());
        counts.push({ name, cluster: clusterFor(name), hot: all.count ?? 0, eligible: old.count ?? 0 });
      }
    } catch (e) { dbError = `Could not read Supabase: ${(e as Error).message}`; }
  }
  if (mongoConfigured()) {
    try {
      const db = await getDb();
      counts.push(...(await Promise.all(HOT_COLLECTIONS.filter((n) => !isSupabaseCollection(n)).map(async (name) => ({ name, cluster: clusterFor(name), hot: await db.collection(name).estimatedDocumentCount(), eligible: await db.collection(name).countDocuments({ createdAt: { $lt: cutoff } }) })))));
      runs = (await db.collection('archive_runs').find().sort({ startedAt: -1 }).limit(8).toArray()) as unknown as typeof runs;
    } catch (e) { dbError = `Could not read MongoDB: ${(e as Error).message}`; }
  }
  const on = (b: boolean) => <span className={b ? 'text-success' : 'text-ink-muted'}>{b ? 'configured' : 'not configured'}</span>;

  return (
    <div className="max-w-[56rem]">
      <h1 className="text-h1 font-semibold">Data archive</h1>
      <p className="mt-3 max-w-[64ch] text-small text-ink-muted">
        Hot data lives in MongoDB (analytics, chat logs, importer history, AI responses) and in Postgres (older documentation versions and activity logs). Every {process.env.ARCHIVE_CRON_INTERVAL_HOURS ?? 6} hours the worker copies anything older than {days} days into TiDB, reads it back, checks a checksum, and only then deletes it from the hot store. A failed cluster is skipped and retried next run; nothing is deleted before it is confirmed.
      </p>
      <Notice error={searchParams.error ?? (dbError || undefined)} ok={searchParams.ok} />

      <h2 className="mt-8 font-mono text-label uppercase text-ink-muted">Connections</h2>
      <ul className="mt-3 divide-y divide-line border-y border-line text-small">
        <li className="flex justify-between py-2"><span>MongoDB (hot store)</span>{on(mongoConfigured())}</li>
        <li className="flex justify-between py-2"><span>Supabase (Postgres: versions and activity logs)</span>{on(supabaseConfigured())}</li>
        <li className="flex justify-between py-2"><span>Redis (queue, locks, rate limits, cache)</span>{on(redisConfigured())}</li>
        {CLUSTER_IDS.map((id) => <li key={id} className="flex justify-between py-2"><span>TiDB cluster {id}</span>{on(clusterConfigured(id))}</li>)}
      </ul>
      {searchParams.test && <pre className="mt-3 whitespace-pre-wrap border border-line bg-bg-secondary p-4 font-mono text-small text-ink-muted">{searchParams.test}</pre>}
      <div className="mt-4 flex flex-wrap gap-3">
        <form action={testConnections}><button type="submit" className={BTN_GHOST}>Test connections</button></form>
        <form action={runArchiveNow}><button type="submit" className={BTN}>Run archive now</button></form>
      </div>

      <h2 className="mt-8 font-mono text-label uppercase text-ink-muted">Hot collections</h2>
      <ul className="mt-3 divide-y divide-line border-y border-line text-small">
        {counts.map((c) => (
          <li key={c.name} className="grid gap-1 py-2 sm:grid-cols-[1fr_auto_auto] sm:gap-6"><span className="font-mono">{c.name}</span><span className="text-ink-muted">{c.hot.toLocaleString('en-GB')} documents, {c.eligible.toLocaleString('en-GB')} due for archive</span><span className="font-mono text-label uppercase text-ink-muted">to cluster {c.cluster}</span></li>
        ))}
        {counts.length === 0 && <li className="py-2 text-ink-muted">No data sources are configured.</li>}
      </ul>

      <h2 className="mt-8 font-mono text-label uppercase text-ink-muted">Recent runs</h2>
      <ul className="mt-3 divide-y divide-line border-y border-line text-small">
        {runs.map((r) => (
          <li key={String(r._id)} className="py-3">
            <p className="font-mono">{new Date(r.startedAt).toLocaleString('en-GB')} <span className="text-ink-muted">/ {r.trigger}</span></p>
            <ul className="mt-1 text-ink-muted">{r.results.map((x) => <li key={x.collection}>{x.collection}: {x.moved} moved{x.skipped ? ` (skipped: ${x.skipped})` : ''}{x.error ? ` (error: ${x.error})` : ''}</li>)}</ul>
          </li>
        ))}
        {runs.length === 0 && <li className="py-3 text-ink-muted">No runs recorded.</li>}
      </ul>
    </div>
  );
}
