import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { STATUS_LABEL, STATUSES, VISIBILITIES, VISIBILITY_LABEL } from '@/lib/products';
import { createClient } from '@/lib/supabase/server';

export default async function AdminOverview() {
  await requireAdmin();
  const sb = createClient();
  const [{ data: rows }, { data: logs }, { count: newEnquiries }] = await Promise.all([
    sb.from('projects').select('status, visibility'),
    sb.from('activity_logs').select('id, action, actor_email, created_at').order('created_at', { ascending: false }).limit(6),
    sb.from('enquiries').select('id', { count: 'exact', head: true }).eq('status', 'new'),
  ]);
  const count = (k: 'status' | 'visibility', v: string) => (rows ?? []).filter((r) => r[k] === v).length;

  return (
    <div className="max-w-[60rem]">
      <h1 className="text-h1 font-semibold">Overview</h1>
      <p className="mt-2 text-small text-ink-muted">{rows?.length ?? 0} projects</p>
      <Link href="/admin/enquiries?status=new" className="mt-4 inline-block border border-line px-4 py-3 text-small hover:border-ink"><span className="font-mono text-h2 font-semibold">{newEnquiries ?? 0}</span> <span className="text-ink-muted">new {newEnquiries === 1 ? 'enquiry' : 'enquiries'}</span></Link>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section aria-labelledby="vis-h">
          <h2 id="vis-h" className="font-mono text-label uppercase text-ink-muted">By visibility</h2>
          <dl className="mt-3 divide-y divide-line border-y border-line">
            {VISIBILITIES.map((v) => (
              <div key={v} className="flex justify-between py-3 text-small"><dt>{VISIBILITY_LABEL[v]}</dt><dd className="font-mono">{count('visibility', v)}</dd></div>
            ))}
          </dl>
        </section>
        <section aria-labelledby="st-h">
          <h2 id="st-h" className="font-mono text-label uppercase text-ink-muted">By status</h2>
          <dl className="mt-3 divide-y divide-line border-y border-line">
            {STATUSES.map((s) => (
              <div key={s} className="flex justify-between py-3 text-small"><dt>{STATUS_LABEL[s]}</dt><dd className="font-mono">{count('status', s)}</dd></div>
            ))}
          </dl>
        </section>
      </div>

      <section aria-labelledby="act-h" className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 id="act-h" className="font-mono text-label uppercase text-ink-muted">Recent activity</h2>
          <Link href="/admin/logs" className="font-mono text-label uppercase hover:text-brand-gold">All</Link>
        </div>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {(logs ?? []).map((l) => (
            <li key={l.id} className="flex flex-wrap justify-between gap-2 py-3 text-small">
              <span className="font-mono">{l.action}</span>
              <span className="text-ink-muted">{l.actor_email ?? 'system'} / {new Date(l.created_at).toLocaleString('en-GB')}</span>
            </li>
          ))}
          {(logs ?? []).length === 0 && <li className="py-3 text-small text-ink-muted">No activity yet.</li>}
        </ul>
      </section>
    </div>
  );
}
