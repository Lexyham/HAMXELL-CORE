'use server';

import { headers } from 'next/headers';
import { emailConfigured, sendEmail } from '@/lib/email';
import { deliverEnquiryEmails } from '@/lib/enquiry-delivery';
import { ackEmail, notifyEmail } from '@/lib/email-templates';
import { validateEnquiry } from '@/lib/enquiry';
import { rateLimit } from '@/lib/rate-limit';
import { serviceClient } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/supabase/config';

export interface EnquiryPayload { name: string; email: string; subject: string; message: string; website: string; ts: number }
const MIN_FILL_MS = 1500;

/**
 * Flow (spec section 11): honeypot + rate limit + validation, row saved in Supabase, then Brevo acknowledgement to the visitor
 * and notification to the admin. The enquiry is saved before any email is attempted, so a Brevo outage never loses a message.
 */
export async function submitEnquiry(p: EnquiryPayload): Promise<{ ok: true; emailWarning: boolean } | { error: string }> {
  if (typeof p.website === 'string' && p.website.trim() !== '') return { ok: true, emailWarning: false }; // honeypot: bots fill it, humans never see it
  if (!Number.isFinite(p.ts) || Date.now() - p.ts < MIN_FILL_MS) return { error: 'Please take a moment to review your message and send it again.' };

  const caller = headers().get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'; // transient rate-limit key only; never stored
  const max = Number(process.env.RATE_LIMIT_CONTACT_PER_HOUR ?? 5);
  if (!(await rateLimit(`contact:${caller}`, max, 60 * 60 * 1000))) return { error: 'Too many enquiries from this connection. Please try again later.' };

  const v = validateEnquiry(p as unknown as Record<string, unknown>);
  if (!v.ok) return { error: v.error };
  if (!supabaseConfigured()) return { error: 'The contact form is not available yet.' };

  const sb = serviceClient();
  const { data, error } = await sb.from('enquiries').insert(v.value).select('id').single();
  if (error || !data) {
    console.error('enquiry insert failed', error?.message);
    return { error: 'Your message could not be saved. Please try again shortly.' };
  }

  const adminTo = process.env.BREVO_ADMIN_NOTIFY_EMAIL;
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const delivery = await deliverEnquiryEmails({
    ackSentAt: null,
    notifiedAt: null,
    sendAcknowledgement: () => sendEmail(
      { email: v.value.email, name: v.value.name },
      ackEmail(v.value),
      adminTo ? { email: adminTo } : undefined,
    ),
    sendNotification: () => adminTo
      ? sendEmail({ email: adminTo }, notifyEmail(v.value, data.id, appUrl), { email: v.value.email, name: v.value.name })
      : Promise.resolve({ ok: false as const, error: 'BREVO_ADMIN_NOTIFY_EMAIL is not set.' }),
    persist: async (patch) => {
      const { error: updateError } = await sb.from('enquiries').update(patch).eq('id', data.id);
      return updateError?.message ?? null;
    },
  });
  if (delivery.errors.length) console.error('enquiry email delivery needs attention', data.id, delivery.errors.join(' | '));
  return { ok: true, emailWarning: delivery.errors.length > 0 };
}
