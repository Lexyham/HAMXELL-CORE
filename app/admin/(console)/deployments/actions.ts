'use server';

import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const t = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

export async function addDeployment(fd: FormData) {
  const { user, email } = await requireAdmin();
  const fail = (m: string): never => redirect(`/admin/deployments?error=${encodeURIComponent(m)}`);
  const project = t(fd, 'project_id'), version = t(fd, 'version'), env = t(fd, 'environment'), status = t(fd, 'status');
  const when = t(fd, 'deployed_at');
  const url = t(fd, 'url');
  if (!UUID.test(project)) fail('Choose a project.');
  if (!version || version.length > 60) fail('Enter a version (up to 60 characters).');
  if (!['production', 'staging', 'preview'].includes(env)) fail('Invalid environment.');
  if (!['success', 'failed', 'rolled_back'].includes(status)) fail('Invalid status.');
  if (url) { try { if (!/^https?:$/.test(new URL(url).protocol)) throw 0; } catch { fail('URL must be a valid http(s) address.'); } }
  const at = when ? new Date(when) : new Date();
  if (Number.isNaN(at.getTime())) fail('Invalid date.');

  const { data, error } = await createClient().from('deployments').insert({
    project_id: project, version, environment: env, status, platform: t(fd, 'platform') || null, url: url || null,
    commit_ref: t(fd, 'commit_ref').slice(0, 80) || null, notes: t(fd, 'notes').slice(0, 4000), deployed_at: at.toISOString(), created_by: user.id,
  }).select('id').single();
  if (error || !data) fail('Could not record the deployment.');
  await logActivity({ actorId: user.id, actorEmail: email, action: 'deployment.create', entity: 'deployment', entityId: data!.id, meta: { project, version, env, status } });
  redirect('/admin/deployments');
}

export async function deleteDeployment(fd: FormData) {
  const { user, email } = await requireAdmin();
  const id = t(fd, 'id');
  if (UUID.test(id)) {
    const { error } = await createClient().from('deployments').delete().eq('id', id);
    if (!error) await logActivity({ actorId: user.id, actorEmail: email, action: 'deployment.delete', entity: 'deployment', entityId: id });
  }
  redirect('/admin/deployments');
}
