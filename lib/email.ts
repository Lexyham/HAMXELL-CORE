import 'server-only';
import { oneLine } from './enquiry';
import type { Mail } from './email-templates';

export const emailConfigured = () => Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
interface Party { email: string; name?: string }

/** Sends one transactional email through Brevo (POST /v3/smtp/email). The sender address must be verified in Brevo. Never throws. */
export async function sendEmail(to: Party, mail: Mail, replyTo?: Party): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!emailConfigured()) return { ok: false, error: 'Email is not configured (BREVO_API_KEY, BREVO_SENDER_EMAIL).' };
  const party = (p: Party) => ({ email: oneLine(p.email), ...(p.name ? { name: oneLine(p.name).slice(0, 100) } : {}) });
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY!, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { name: process.env.BREVO_SENDER_NAME || 'HAMXELL CORE', email: process.env.BREVO_SENDER_EMAIL },
        to: [party(to)],
        ...(replyTo ? { replyTo: party(replyTo) } : {}),
        subject: oneLine(mail.subject).slice(0, 200),
        textContent: mail.text,
        htmlContent: mail.html,
      }),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    if (res.ok) return { ok: true };
    let detail = '';
    try { detail = oneLine(String(((await res.json()) as { message?: string }).message ?? '')).slice(0, 160); } catch { /* no body */ }
    return { ok: false, error: `Brevo responded ${res.status}${detail ? `: ${detail}` : ''}` };
  } catch (e) {
    return { ok: false, error: (e as Error).name === 'TimeoutError' ? 'Brevo did not respond in time.' : 'Could not reach Brevo.' };
  }
}
