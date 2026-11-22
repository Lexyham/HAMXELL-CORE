import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';

/** Session + MFA (aal2) + admin-table membership. Call at the top of every admin page and action. */
export async function requireAdmin(opts: { allowPasswordChange?: boolean } = {}) {
  const sb = createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect('/admin/login');
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') redirect('/admin/login');
  const { data: admin } = await sb.from('admins').select('role').eq('user_id', data.user.id).maybeSingle();
  if (!admin) redirect('/admin/login');
  // Accounts created with a temporary password must set their own before doing anything else.
  if (data.user.app_metadata?.must_change_password === true && !opts.allowPasswordChange) redirect('/admin/account/password');
  return { user: data.user, email: data.user.email ?? '', role: admin.role as 'owner' | 'editor' };
}

/** Vault and other owner-only areas. Editors are sent back to the overview. */
export async function requireOwner() {
  const a = await requireAdmin();
  if (a.role !== 'owner') redirect('/admin');
  return a;
}
