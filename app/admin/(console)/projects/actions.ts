'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { requireAdmin } from '@/lib/auth';
import { CATEGORIES, STATUSES, VISIBILITIES, type Category, type ProjectStatus, type Visibility } from '@/lib/products';
import { hashGatePassword } from '@/lib/gate';
import { createClient } from '@/lib/supabase/server';

const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

/** '' -> null, valid http(s) URL -> normalised string, anything else -> undefined (invalid). */
function httpUrl(v: string): string | null | undefined {
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

export async function saveProject(fd: FormData) {
  const { user, email } = await requireAdmin();
  const id = text(fd, 'id');
  const back = id ? `/admin/projects/${id}` : '/admin/projects/new';
  const fail = (m: string): never => redirect(`${back}?error=${encodeURIComponent(m)}`);

  const slug = text(fd, 'slug').toLowerCase();
  const name = text(fd, 'name');
  const status = text(fd, 'status') as ProjectStatus;
  const visibility = text(fd, 'visibility') as Visibility;
  const category = (text(fd, 'category') || 'product') as Category;
  const launch = httpUrl(text(fd, 'launch_url'));
  const licenceUrl = httpUrl(text(fd, 'licence_url'));

  if (!name) fail('Name is required.');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length < 2 || slug.length > 60) fail('Slug must be 2-60 lowercase letters, numbers or hyphens.');
  if (!STATUSES.includes(status)) fail('Invalid status.');
  if (!VISIBILITIES.includes(visibility)) fail('Invalid visibility.');
  if (!CATEGORIES.includes(category)) fail('Invalid category.');
  if (launch === undefined) fail('Launch URL must be a valid http(s) address.');
  if (licenceUrl === undefined) fail('Licence URL must be a valid http(s) address.');

  const row = {
    slug,
    name,
    summary: text(fd, 'summary').slice(0, 240),
    description: text(fd, 'description'),
    status,
    visibility,
    category,
    tags: text(fd, 'tags').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 12),
    launch_url: launch ?? null,
    warning_text: text(fd, 'warning_text') || null,
    licence_type: text(fd, 'licence_type') || null,
    licence_text: text(fd, 'licence_text') || null,
    licence_url: licenceUrl ?? null,
    featured: fd.get('featured') === 'on' && visibility === 'public',
  };

  const sb = createClient();
  const { data, error } = id
    ? await sb.from('projects').update(row).eq('id', id).select('id').single()
    : await sb.from('projects').insert(row).select('id').single();
  if (error || !data) fail(error?.code === '23505' ? 'That slug is already in use.' : 'Could not save the project.');

  // Gate password: stored hashed in its own table; removing it or replacing it is logged, the value never is.
  const gate = String(fd.get('gate_password') ?? '');
  if (fd.get('remove_gate') === 'on') {
    await sb.from('project_gates').delete().eq('project_id', data!.id);
    await logActivity({ actorId: user.id, actorEmail: email, action: 'project.gate_removed', entity: 'project', entityId: data!.id });
  } else if (gate) {
    if (visibility !== 'warning') fail('An access password applies only to warning-gated projects.');
    if (gate.length < 6 || gate.length > 200) fail('The access password must be 6 to 200 characters.');
    await sb.from('project_gates').upsert({ project_id: data!.id, password_hash: await hashGatePassword(gate) });
    await logActivity({ actorId: user.id, actorEmail: email, action: 'project.gate_set', entity: 'project', entityId: data!.id });
  }

  await logActivity({
    actorId: user.id,
    actorEmail: email,
    action: id ? 'project.update' : 'project.create',
    entity: 'project',
    entityId: data!.id,
    meta: { slug, status, visibility },
  });
  revalidatePath('/', 'layout');
  redirect('/admin/projects');
}

export async function deleteProject(fd: FormData) {
  const { user, email } = await requireAdmin();
  const id = text(fd, 'id');
  const sb = createClient();
  const { data } = await sb.from('projects').select('slug').eq('id', id).maybeSingle();
  const { error } = await sb.from('projects').delete().eq('id', id);
  if (!error) {
    await logActivity({ actorId: user.id, actorEmail: email, action: 'project.delete', entity: 'project', entityId: id, meta: { slug: data?.slug } });
    revalidatePath('/', 'layout');
  }
  redirect('/admin/projects');
}
