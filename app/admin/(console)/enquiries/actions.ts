'use server';

import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { requireAdmin } from '@/lib/auth';
import { sendEmail, emailConfigured } from '@/lib/email';
import { ackEmail, notifyEmail } from '@/lib/email-templates';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENQUIRY_STATUSES = ['new', 'read', 'replied', 'closed'] as const;

export async function setEnquiryStatus(fd: FormData) {
  const { user, email } = await requireAdmin();
  const id = String(fd.get('id') ?? '');
  const status = String(fd.get('status') ?? '');
  if (!UUID.test(id) || !(ENQUIRY_STATUSES as readonly string[]).includes(status)) redirect('/admin/enquiries');
  const sb = createClient();
  const { data: before } = await sb.from('enquiries').select('status').eq('id', id).maybeSingle();
  if (before && before.status !== status) {
    const { error } = await sb.from('enquiries').update({ status, replied_at: status === 'replied' ? new Date().toISOString() : undefined }).eq('id', id);
    if (!error) await logActivity({ actorId: user.id, actorEmail: email, action: 'enquiry.status', entity: 'enquiry', entityId: id, meta: { from: before.status, to: status } });
  }
  redirect(`/admin/enquiries/${id}`);
}

/** Retries whichever Brevo email has not been accepted yet. */
export async function resendEmails(fd: FormData) {
  const { user, email } = await requireAdmin();
  const id = String(fd.get('id') ?? '');
  const back = (q: string): never => redirect(`/admin/enquiries/${id}?${q}`);
  if (!UUID.test(id)) redirect('/admin/enquiries');
  if (!emailConfigured()) back(`error=${encodeURIComponent('Email is not configured (BREVO_API_KEY, BREVO_SENDER_EMAIL).')}`);
  const sb = createClient();
  const { data: e } = await sb.from('enquiries').select('*').eq('id', id).maybeSingle();
  if (!e) redirect('/admin/enquiries');
  const v = { name: e!.name as string, email: e!.email as string, subject: e!.subject as string, message: e!.message as string };
  const adminTo = process.env.BREVO_ADMIN_NOTIFY_EMAIL;
  const errors: string[] = [];
  const patch: Record<string, unknown> = {};
  if (!e!.ack_sent_at) {
    const r = await sendEmail({ email: v.email, name: v.name }, ackEmail(v), adminTo ? { email: adminTo } : undefined);
    if (r.ok) patch.ack_sent_at = new Date().toISOString(); else errors.push(`acknowledgement: ${r.error}`);
  }
  if (!e!.notified_at) {
    if (!adminTo) errors.push('notification: BREVO_ADMIN_NOTIFY_EMAIL is not set.');
    else {
      const r = await sendEmail({ email: adminTo }, notifyEmail(v, id, process.env.APP_URL ?? 'http://localhost:3000'), { email: v.email, name: v.name });
      if (r.ok) patch.notified_at = new Date().toISOString(); else errors.push(`notification: ${r.error}`);
    }
  }
  patch.email_error = errors.join(' | ') || null;
  await sb.from('enquiries').update(patch).eq('id', id);
  await logActivity({ actorId: user.id, actorEmail: email, action: 'enquiry.resend_emails', entity: 'enquiry', entityId: id, meta: { failed: errors.length } });
  back(errors.length ? `error=${encodeURIComponent(errors.join(' | '))}` : `ok=${encodeURIComponent('Emails sent.')}`);
}
