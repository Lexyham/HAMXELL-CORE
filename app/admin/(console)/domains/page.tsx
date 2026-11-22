import Link from 'next/link';
import DomainForm from '@/components/admin/DomainForm';
import { Notice } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/auth';
import { expiryState } from '@/lib/ops';
import { createClient } from '@/lib/supabase/server';

const TONE = { expired: 'border-danger text-danger', critical: 'border-danger text-danger', soon: 'border-warning text-warning', ok: 'border-line text-ink-muted', none: 'border-line text-ink-muted' } as const;

export default async function DomainsPage({ searchParams }: { searchParams: { error?: string } }) {
  await requireAdmin();
  const sb = createClient();
  const [{ data: domains }, { data: projects }] = await Promise.all([
    sb.from('domains').select('*, projects(name)').order('expires_on', { ascending: true, nullsFirst: false }),
    sb.from('projects').select('id, name').order('name'),
  ]);
  return (
    <div className="max-w-[56rem]">
      <h1 className="text-h1 font-semibold">Domains</h1>
      <p className="mt-2 text-small text-ink-muted">Expiry badges: critical is 14 days or fewer, soon is 60 days or fewer.</p>
      <ul className="mt-6 divide-y divide-line border-y border-line">
        {(domains ?? []).map((d) => {
          const e = expiryState(d.expires_on);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const project = (d as any).projects?.name as string | undefined;
          return (
            <li key={d.id}>
              <Link href={`/admin/domains/${d.id}`} className="grid gap-2 py-4 hover:bg-bg-secondary sm:grid-cols-[1fr_auto] sm:items-center sm:gap-5">
                <span>
                  <span className="block font-mono text-body">{d.domain}</span>
                  <span className="block text-small text-ink-muted">{[project, d.registrar, d.host].filter(Boolean).join(' / ') || 'No details'}{d.auto_renew ? ' / auto-renew' : ''}</span>
                </span>
                <span className={`w-fit border px-2 py-[2px] font-mono text-label uppercase ${TONE[e.state]}`}>
                  {e.state === 'none' ? 'No expiry' : e.state === 'expired' ? `Expired ${Math.abs(e.days!)}d ago` : `${e.days}d left / ${d.expires_on}`}
                </span>
              </Link>
            </li>
          );
        })}
        {(domains ?? []).length === 0 && <li className="py-4 text-small text-ink-muted">No domains recorded.</li>}
      </ul>
      <h2 className="mt-8 font-mono text-label uppercase text-ink-muted">Add a domain</h2>
      <Notice error={searchParams.error} />
      <div className="mt-4"><DomainForm projects={projects ?? []} /></div>
    </div>
  );
}
