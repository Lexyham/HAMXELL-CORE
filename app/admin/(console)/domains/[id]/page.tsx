import Link from 'next/link';
import { notFound } from 'next/navigation';
import DomainForm from '@/components/admin/DomainForm';
import { BTN_DANGER, Notice } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { deleteDomain } from '../actions';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditDomain({ params, searchParams }: { params: { id: string }; searchParams: { error?: string } }) {
  await requireAdmin();
  if (!UUID.test(params.id)) notFound();
  const sb = createClient();
  const [{ data: domain }, { data: projects }] = await Promise.all([sb.from('domains').select('*').eq('id', params.id).maybeSingle(), sb.from('projects').select('id, name').order('name')]);
  if (!domain) notFound();
  return (
    <div className="max-w-[44rem]">
      <Link href="/admin/domains" className="font-mono text-label uppercase text-ink-muted hover:text-ink">Domains</Link>
      <h1 className="mt-4 break-all font-mono text-h1 font-semibold">{domain.domain}</h1>
      <Notice error={searchParams.error} />
      <div className="mt-6"><DomainForm domain={domain} projects={projects ?? []} /></div>
      <form action={deleteDomain} className="mt-8"><input type="hidden" name="id" value={domain.id} /><button type="submit" className={BTN_DANGER}>Delete domain record</button></form>
    </div>
  );
}
