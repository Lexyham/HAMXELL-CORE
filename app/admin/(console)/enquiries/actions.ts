'use server';

import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { requireAdmin } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { ackEmail, notifyEmail } from '@/lib/email-templates';
import { deliverEnquiryEmails, EMAIL_DELIVERY_PENDING } from '@/lib/enquiry-delivery';
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
  const sb = createClient();
  const { data: e } = await sb.from('enquiries').select('*').eq('id', id).maybeSingle();
  if (!e) redirect('/admin/enquiries');
  if (e.ack_sent_at && e.notified_at) back(`ok=${encodeURIComponent('Both emails are already marked sent.')}`);
  const updatedAt = Date.parse(e.updated_at);
  if (e.email_error === EMAIL_DELIVERY_PENDING && Number.isFinite(updatedAt) && Date.now() - updatedAt < 120_000) {
    back(`error=${encodeURIComponent('An email delivery attempt is already in progress. Refresh the page before retrying.')}`);
  }
  const { data: claimed, error: claimError } = await sb.from('enquiries')
    .update({ email_error: EMAIL_DELIVERY_PENDING })
    .eq('id', id)
    .eq('updated_at', e.updated_at)
    .select('id')
    .maybeSingle();
  if (claimError || !claimed) back(`error=${encodeURIComponent('Another email delivery attempt may be in progress. Refresh the page before retrying.')}`);
  const v = { name: e!.name as string, email: e!.email as string, subject: e!.subject as string, message: e!.message as string };
  const adminTo = process.env.BREVO_ADMIN_NOTIFY_EMAIL;
  const delivery = await deliverEnquiryEmails({
    ackSentAt: e!.ack_sent_at,
    notifiedAt: e!.notified_at,
    sendAcknowledgement: () => sendEmail({ email: v.email, name: v.name }, ackEmail(v), adminTo ? { email: adminTo } : undefined),
    sendNotification: () => adminTo
      ? sendEmail({ email: adminTo }, notifyEmail(v, id, process.env.APP_URL ?? 'http://localhost:3000'), { email: v.email, name: v.name })
      : Promise.resolve({ ok: false as const, error: 'BREVO_ADMIN_NOTIFY_EMAIL is not set.' }),
    persist: async (patch) => {
      const { error } = await sb.from('enquiries').update(patch).eq('id', id);
      return error?.message ?? null;
    },
  });
  const errors = delivery.errors;
  await logActivity({ actorId: user.id, actorEmail: email, action: 'enquiry.resend_emails', entity: 'enquiry', entityId: id, meta: { failed: errors.length } });
  back(errors.length ? `error=${encodeURIComponent(errors.join(' | '))}` : `ok=${encodeURIComponent('Emails sent.')}`);
}
