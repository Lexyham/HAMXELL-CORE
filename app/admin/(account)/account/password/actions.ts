'use server';

import { createClient as createVerifier } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { requireAdmin } from '@/lib/auth';
import { passwordProblem } from '@/lib/gate';
import { isLimited, recordHit } from '@/lib/rate-limit';
import { serviceClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/** Changing the password needs the current one (checked with a throw-away client), a strong new one, and clears the "must change" flag. */
export async function changePassword(current: string, next: string): Promise<{ error: string } | never> {
  const { user, email } = await requireAdmin({ allowPasswordChange: true });
  const key = `pwchange:${user.id}`;
  if (await isLimited(key, 5, 15 * 60 * 1000)) return { error: 'Too many attempts. Try again in 15 minutes.' };
  if (!current) return { error: 'Enter your current password.' };
  const problem = passwordProblem(next, email);
  if (problem) return { error: problem };
  if (next === current) return { error: 'Choose a password different from the current one.' };

  const verifier = createVerifier(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: bad } = await verifier.auth.signInWithPassword({ email, password: current });
  if (bad) { await recordHit(key); return { error: 'The current password is incorrect.' }; }
  await verifier.auth.signOut();

  const { error } = await createClient().auth.updateUser({ password: next });
  if (error) return { error: 'The password could not be changed. Try again.' };
  await serviceClient().auth.admin.updateUserById(user.id, { app_metadata: { must_change_password: false } });
  await logActivity({ actorId: user.id, actorEmail: email, action: 'admin.password_change' });
  redirect('/admin');
}
