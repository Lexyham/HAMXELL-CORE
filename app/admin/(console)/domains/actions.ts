'use server';

import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOMAIN = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const t = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

export async function saveDomain(fd: FormData) {
  const { user, email } = await requireAdmin();
  const id = t(fd, 'id');
  const back = id ? `/admin/domains/${id}` : '/admin/domains';
  const fail = (m: string): never => redirect(`${back}?error=${encodeURIComponent(m)}`);

  const domain = t(fd, 'domain').toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const exp = t(fd, 'expires_on');
  const project = t(fd, 'project_id');
  if (!DOMAIN.test(domain)) fail('Enter a valid domain name, for example example.com.');
  if (exp && !/^\d{4}-\d{2}-\d{2}$/.test(exp)) fail('Expiry must be a date.');
  if (project && !UUID.test(project)) fail('Invalid project.');

  const row = { domain, project_id: project || null, registrar: t(fd, 'registrar') || null, host: t(fd, 'host') || null, expires_on: exp || null, auto_renew: fd.get('auto_renew') === 'on', notes: t(fd, 'notes').slice(0, 4000) };
  const sb = createClient();
  const { data, error } = id && UUID.test(id)
    ? await sb.from('domains').update(row).eq('id', id).select('id').single()
    : await sb.from('domains').insert(row).select('id').single();
  if (error || !data) fail(error?.code === '23505' ? 'That domain is already recorded.' : 'Could not save the domain.');
  await logActivity({ actorId: user.id, actorEmail: email, action: id ? 'domain.update' : 'domain.create', entity: 'domain', entityId: data!.id, meta: { domain } });
  redirect('/admin/domains');
}

export async function deleteDomain(fd: FormData) {
  const { user, email } = await requireAdmin();
  const id = t(fd, 'id');
  if (UUID.test(id)) {
    const { error } = await createClient().from('domains').delete().eq('id', id);
    if (!error) await logActivity({ actorId: user.id, actorEmail: email, action: 'domain.delete', entity: 'domain', entityId: id });
  }
  redirect('/admin/domains');
}
