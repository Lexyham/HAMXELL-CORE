'use server';

import { randomBytes } from 'node:crypto';
import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { requireOwner } from '@/lib/auth';
import { serviceClient } from '@/lib/supabase/admin';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const back = (q: string): never => redirect(`/admin/settings?${q}`);

async function ownerCount(): Promise<number> {
  const { count } = await serviceClient().from('admins').select('user_id', { count: 'exact', head: true }).eq('role', 'owner');
  return count ?? 0;
}

/**
 * Creates an admin account with a random temporary password, shown once to the caller. The new admin must enrol an authenticator app
 * and choose their own password at first sign-in (enforced by the must_change_password flag).
 */
export async function addAdmin(email: string, role: string): Promise<{ ok: true; email: string; tempPassword: string } | { error: string }> {
  const { user, email: me } = await requireOwner();
  const e = String(email ?? '').trim().toLowerCase();
  if (!EMAIL.test(e) || e.length > 254) return { error: 'Enter a valid email address.' };
  if (role !== 'owner' && role !== 'editor') return { error: 'Choose a role.' };

  const sb = serviceClient();
  const tempPassword = randomBytes(18).toString('base64url');
  const created = await sb.auth.admin.createUser({ email: e, password: tempPassword, email_confirm: true, app_metadata: { must_change_password: true } });
  if (created.error || !created.data.user) return { error: /already|registered|exists/i.test(created.error?.message ?? '') ? 'An account with that email already exists.' : 'The account could not be created.' };
  const { error } = await sb.from('admins').insert({ user_id: created.data.user.id, email: e, role });
  if (error) { await sb.auth.admin.deleteUser(created.data.user.id); return { error: 'The admin record could not be saved, so the account was removed.' }; }
  await logActivity({ actorId: user.id, actorEmail: me, action: 'admin.add', entity: 'admin', entityId: created.data.user.id, meta: { email: e, role } });
  return { ok: true, email: e, tempPassword };
}

export async function setAdminRole(fd: FormData) {
  const { user, email } = await requireOwner();
  const id = String(fd.get('id') ?? ''), role = String(fd.get('role') ?? '');
  if (!UUID.test(id) || (role !== 'owner' && role !== 'editor')) back('error=Invalid%20request.');
  if (id === user.id) back('error=' + encodeURIComponent('You cannot change your own role.'));
  const sb = serviceClient();
  const { data: row } = await sb.from('admins').select('role, email').eq('user_id', id).maybeSingle();
  if (!row) back('error=Not%20found.');
  if (row!.role === 'owner' && role !== 'owner' && (await ownerCount()) <= 1) back('error=' + encodeURIComponent('There must always be at least one owner.'));
  const { error } = await sb.from('admins').update({ role }).eq('user_id', id);
  if (!error) await logActivity({ actorId: user.id, actorEmail: email, action: 'admin.role', entity: 'admin', entityId: id, meta: { email: row!.email, from: row!.role, to: role } });
  back(error ? 'error=' + encodeURIComponent('Could not change the role.') : 'ok=' + encodeURIComponent('Role updated.'));
}

/** Removing an admin takes effect at once: every admin page and action checks the admins table on each request. */
export async function removeAdmin(fd: FormData) {
  const { user, email } = await requireOwner();
  const id = String(fd.get('id') ?? '');
  if (!UUID.test(id)) back('error=Invalid%20request.');
  if (id === user.id) back('error=' + encodeURIComponent('You cannot remove yourself.'));
  const sb = serviceClient();
  const { data: row } = await sb.from('admins').select('role, email').eq('user_id', id).maybeSingle();
  if (!row) back('error=Not%20found.');
  if (row!.role === 'owner' && (await ownerCount()) <= 1) back('error=' + encodeURIComponent('There must always be at least one owner.'));
  const { error } = await sb.from('admins').delete().eq('user_id', id);
  if (!error) await logActivity({ actorId: user.id, actorEmail: email, action: 'admin.remove', entity: 'admin', entityId: id, meta: { email: row!.email } });
  back(error ? 'error=' + encodeURIComponent('Could not remove the admin.') : 'ok=' + encodeURIComponent('Admin removed.'));
}
