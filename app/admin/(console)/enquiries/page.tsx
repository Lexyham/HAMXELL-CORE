import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const TABS = ['all', 'new', 'read', 'replied', 'closed'] as const;
const TONE: Record<string, string> = { new: 'border-brand-gold text-brand-gold', read: 'border-line text-ink-muted', replied: 'border-success text-success', closed: 'border-line text-ink-muted' };

export default async function EnquiriesPage({ searchParams }: { searchParams: { status?: string } }) {
  await requireAdmin();
  const tab = (TABS as readonly string[]).includes(searchParams.status ?? '') ? searchParams.status! : 'all';
  let q = createClient().from('enquiries').select('id, name, email, subject, message, status, email_error, created_at').order('created_at', { ascending: false }).limit(100);
  if (tab !== 'all') q = q.eq('status', tab);
  const { data } = await q;

  return (
    <div className="max-w-[56rem]">
      <h1 className="text-h1 font-semibold">Enquiries</h1>
      <nav aria-label="Filter" className="mt-5 flex flex-wrap gap-4 font-mono text-label uppercase">
        {TABS.map((t) => <Link key={t} href={t === 'all' ? '/admin/enquiries' : `/admin/enquiries?status=${t}`} className={tab === t ? 'text-ink' : 'text-ink-muted hover:text-ink'}>{t}</Link>)}
      </nav>
      <ul className="mt-5 divide-y divide-line border-y border-line">
        {(data ?? []).map((e) => (
          <li key={e.id}>
            <Link href={`/admin/enquiries/${e.id}`} className="grid gap-1 py-4 hover:bg-bg-secondary sm:grid-cols-[1fr_auto] sm:gap-5">
              <span className="min-w-0">
                <span className="block text-body font-medium">{e.name} <span className="font-normal text-ink-muted">&lt;{e.email}&gt;</span></span>
                <span className="block truncate text-small text-ink-muted">{e.subject || e.message}</span>
                {e.email_error && <span className="block text-small text-warning">Email problem, open to retry</span>}
              </span>
              <span className="flex items-start gap-3">
                <span className="font-mono text-label uppercase text-ink-muted">{new Date(e.created_at).toLocaleDateString('en-GB')}</span>
                <span className={`border px-2 py-[2px] font-mono text-label uppercase ${TONE[e.status]}`}>{e.status}</span>
              </span>
            </Link>
          </li>
        ))}
        {(data ?? []).length === 0 && <li className="py-4 text-small text-ink-muted">No enquiries.</li>}
      </ul>
    </div>
  );
}
