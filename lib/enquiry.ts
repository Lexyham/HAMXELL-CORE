/** Contact-form validation (pure, shared by the server action and tests). */
export interface EnquiryInput { name: string; email: string; subject: string; message: string }

// Control characters and line breaks are stripped from single-line fields so they can never be used to inject headers.
export const oneLine = (s: string) => s.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim();
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function validateEnquiry(raw: Record<string, unknown>): { ok: true; value: EnquiryInput } | { ok: false; error: string } {
  const s = (k: string) => (typeof raw[k] === 'string' ? (raw[k] as string) : '');
  const name = oneLine(s('name'));
  const email = oneLine(s('email')).toLowerCase();
  const subject = oneLine(s('subject'));
  const message = s('message').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();

  if (!name || name.length > 100) return { ok: false, error: 'Enter your name (up to 100 characters).' };
  if (email.length > 254 || !EMAIL.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  if (subject.length > 150) return { ok: false, error: 'The subject is too long (up to 150 characters).' };
  if (message.length < 10) return { ok: false, error: 'Please write a little more (at least 10 characters).' };
  if (message.length > 5000) return { ok: false, error: 'The message is too long (up to 5,000 characters).' };
  return { ok: true, value: { name, email, subject, message } };
}
