import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Notice, BTN_GHOST } from '@/components/admin/ui';
import { logActivity } from '@/lib/activity';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { resendEmails, setEnquiryStatus } from '../actions';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES = ['new', 'read', 'replied', 'closed'] as const;

export default async function EnquiryPage({ params, searchParams }: { params: { id: string }; searchParams: { error?: string; ok?: string } }) {
  const { user, email } = await requireAdmin();
  if (!UUID.test(params.id)) notFound();
  const sb = createClient();
  const { data: e } = await sb.from('enquiries').select('*').eq('id', params.id).maybeSingle();
  if (!e) notFound();

  let status = e.status as string;
  if (status === 'new') { // opening a new enquiry marks it read, and that state change is logged
    const { error } = await sb.from('enquiries').update({ status: 'read' }).eq('id', e.id);
    if (!error) { status = 'read'; await logActivity({ actorId: user.id, actorEmail: email, action: 'enquiry.status', entity: 'enquiry', entityId: e.id, meta: { from: 'new', to: 'read', auto: true } }); }
  }
  const reply = `mailto:${encodeURIComponent(e.email).replace(/%40/g, '@')}?subject=${encodeURIComponent(`Re: ${e.subject || 'your enquiry'}`)}`;
  const emailsOk = e.ack_sent_at && e.notified_at;

  return (
    <div className="max-w-[44rem]">
      <Link href="/admin/enquiries" className="font-mono text-label uppercase text-ink-muted hover:text-ink">Enquiries</Link>
      <h1 className="mt-4 text-h1 font-semibold">{e.subject || 'Enquiry'}</h1>
      <p className="mt-2 break-all text-small text-ink-muted">{e.name} &lt;{e.email}&gt; / {new Date(e.created_at).toLocaleString('en-GB')}</p>
      <Notice error={searchParams.error} ok={searchParams.ok} />

      <p className="mt-6 whitespace-pre-wrap break-words border-l-2 border-line pl-4 text-body">{e.message}</p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <a href={reply} className="border border-brand-blue bg-brand-blue px-5 py-3 text-small font-medium hover:bg-transparent">Reply by email</a>
        {STATES.filter((s) => s !== status).map((s) => (
          <form key={s} action={setEnquiryStatus}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value={s} /><button type="submit" className={BTN_GHOST}>Mark {s}</button></form>
        ))}
      </div>
      <p className="mt-3 font-mono text-label uppercase text-ink-muted">Status: {status}{e.replied_at ? ` / replied ${new Date(e.replied_at).toLocaleDateString('en-GB')}` : ''}</p>

      <section className="mt-8 border border-line p-4">
        <p className="font-mono text-label uppercase text-ink-muted">Email delivery</p>
        <ul className="mt-2 text-small text-ink-muted">
          <li>Acknowledgement to visitor: {e.ack_sent_at ? `sent ${new Date(e.ack_sent_at).toLocaleString('en-GB')}` : 'not sent'}</li>
          <li>Notification to you: {e.notified_at ? `sent ${new Date(e.notified_at).toLocaleString('en-GB')}` : 'not sent'}</li>
        </ul>
        {e.email_error && <p className="mt-2 break-words text-small text-warning">{e.email_error}</p>}
        {!emailsOk && <form action={resendEmails} className="mt-3"><input type="hidden" name="id" value={e.id} /><button type="submit" className={BTN_GHOST}>Retry sending</button></form>}
      </section>
    </div>
  );
}
