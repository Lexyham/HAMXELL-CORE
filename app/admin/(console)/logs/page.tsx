import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export default async function LogsPage() {
  await requireAdmin();
  const { data } = await createClient().from('activity_logs').select('*').order('created_at', { ascending: false }).limit(200);
  return (
    <div className="max-w-[64rem]">
      <h1 className="text-h1 font-semibold">Activity</h1>
      <p className="mt-2 text-small text-ink-muted">Append-only record of admin actions. Latest 200 entries. Entries older than {process.env.ARCHIVE_AGE_DAYS ?? 30} days are moved to the archive (TiDB) by the worker and are no longer listed here.</p>
      <ul className="mt-6 divide-y divide-line border-y border-line">
        {(data ?? []).map((l) => (
          <li key={l.id} className="grid gap-1 py-3 text-small md:grid-cols-[11rem_12rem_1fr] md:gap-4">
            <span className="font-mono text-ink-muted">{new Date(l.created_at).toLocaleString('en-GB')}</span>
            <span className="font-mono">{l.action}</span>
            <span className="break-all text-ink-muted">{l.actor_email ?? 'system'} / {l.ip ?? '-'} {l.entity_id ? `/ ${l.entity} ${l.entity_id}` : ''}</span>
          </li>
        ))}
        {(data ?? []).length === 0 && <li className="py-3 text-small text-ink-muted">No activity yet.</li>}
      </ul>
    </div>
  );
}
