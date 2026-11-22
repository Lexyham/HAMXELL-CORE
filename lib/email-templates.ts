import { esc } from './markdown';
import { oneLine, type EnquiryInput } from './enquiry';

export interface Mail { subject: string; text: string; html: string }
const wrap = (body: string) =>
  `<!doctype html><html><body style="margin:0;padding:24px;background:#ffffff;color:#14161a;font:15px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif"><div style="max-width:36rem">${body}<p style="margin-top:32px;border-top:1px solid #d9dce1;padding-top:12px;font-size:12px;color:#5b616b">HAMXELL CORE</p></div></body></html>`;
const paras = (t: string) => t.split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

/** Acknowledgement to the visitor. Plain, factual, no promises about timing. */
export function ackEmail(e: EnquiryInput): Mail {
  const subject = 'We received your enquiry';
  const text = `Hello ${e.name},\n\nThank you for contacting HAMXELL CORE. Your message has been received and will be read directly.\n\nYour message:\n\n${e.message}\n\nIf you did not send this enquiry, you can ignore this email.\n\nHAMXELL CORE`;
  const html = wrap(`<p style="margin:0 0 12px">Hello ${esc(e.name)},</p><p style="margin:0 0 12px">Thank you for contacting HAMXELL CORE. Your message has been received and will be read directly.</p><p style="margin:16px 0 6px;font-size:12px;color:#5b616b;text-transform:uppercase;letter-spacing:.06em">Your message</p><div style="border-left:2px solid #d9dce1;padding-left:12px;color:#3b4047">${paras(e.message)}</div><p style="margin:16px 0 0;color:#5b616b">If you did not send this enquiry, you can ignore this email.</p>`);
  return { subject, text, html };
}

/** Notification to the admin. All visitor-supplied text is escaped; no visitor link is made clickable. */
export function notifyEmail(e: EnquiryInput, id: string, appUrl: string): Mail {
  const subject = `New enquiry: ${oneLine(e.subject || e.message).slice(0, 80)}`;
  const link = `${appUrl.replace(/\/$/, '')}/admin/enquiries/${id}`;
  const text = `New enquiry\n\nFrom: ${e.name} <${e.email}>\nSubject: ${e.subject || '(none)'}\n\n${e.message}\n\nOpen in the control centre: ${link}`;
  const html = wrap(`<p style="margin:0 0 4px"><strong>${esc(e.name)}</strong> &lt;${esc(e.email)}&gt;</p><p style="margin:0 0 16px;color:#5b616b">Subject: ${esc(e.subject || '(none)')}</p>${paras(e.message)}<p style="margin:16px 0 0"><a href="${esc(link)}">Open in the control centre</a></p>`);
  return { subject, text, html };
}
