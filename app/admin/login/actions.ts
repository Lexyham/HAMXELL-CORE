'use server';

import { redirect } from 'next/navigation';
import { clientIp, logActivity } from '@/lib/activity';
import { rateLimit } from '@/lib/rate-limit';
import { supabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export type SignInResult =
  | { error: string }
  | { kind: 'verify'; factorId: string }
  | { kind: 'enroll'; factorId: string; qr: string; secret: string };

const MAX = Number(process.env.RATE_LIMIT_ADMIN_LOGIN_PER_15MIN ?? 5);
const WINDOW = 15 * 60 * 1000;
const GENERIC = 'Invalid credentials.';

export async function signIn(email: string, password: string): Promise<SignInResult> {
  if (!supabaseConfigured()) return { error: 'Supabase is not configured. See .env.' };
  if (!(await rateLimit(`signin:${clientIp()}`, MAX, WINDOW))) return { error: 'Too many attempts. Try again in 15 minutes.' };

  const sb = createClient();
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) {
    await logActivity({ action: 'admin.login_failed', actorEmail: email.trim().slice(0, 200) });
    return { error: GENERIC };
  }

  const { data: admin } = await sb.from('admins').select('role').eq('user_id', data.user.id).maybeSingle();
  if (!admin) {
    await sb.auth.signOut();
    await logActivity({ action: 'admin.login_denied', actorId: data.user.id, actorEmail: data.user.email });
    return { error: GENERIC };
  }

  const { data: factors } = await sb.auth.mfa.listFactors();
  const verified = factors?.totp?.[0];
  if (verified) return { kind: 'verify', factorId: verified.id };

  // First sign-in: clear any abandoned enrolment, then start a fresh one.
  for (const f of factors?.all ?? []) if (f.status === 'unverified') await sb.auth.mfa.unenroll({ factorId: f.id });
  const enrol = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: `hamxell-${Date.now()}` });
  if (enrol.error || !enrol.data) return { error: 'Could not start MFA enrolment.' };
  return { kind: 'enroll', factorId: enrol.data.id, qr: enrol.data.totp.qr_code, secret: enrol.data.totp.secret };
}

export async function verifyTotp(factorId: string, code: string): Promise<{ ok: true } | { error: string }> {
  if (!(await rateLimit(`totp:${clientIp()}`, MAX * 2, WINDOW))) return { error: 'Too many attempts. Try again in 15 minutes.' };
  const sb = createClient();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return { error: 'Session expired. Sign in again.' };

  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, '') });
  if (error) {
    await logActivity({ action: 'admin.mfa_failed', actorId: u.user.id, actorEmail: u.user.email });
    return { error: 'Invalid code.' };
  }
  await logActivity({ action: 'admin.login', actorId: u.user.id, actorEmail: u.user.email });
  return { ok: true };
}

export async function signOutAction() {
  const sb = createClient();
  const { data } = await sb.auth.getUser();
  if (data.user) await logActivity({ action: 'admin.logout', actorId: data.user.id, actorEmail: data.user.email });
  await sb.auth.signOut();
  redirect('/admin/login');
}
