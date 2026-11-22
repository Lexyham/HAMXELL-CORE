'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { submitEnquiry } from '@/app/(public)/contact/actions';
import Magnetic from './Magnetic';

const field = 'mt-2 w-full border border-line bg-bg-secondary px-3 py-3 text-body text-ink focus:border-brand-blue focus:outline-none';
const label = 'block font-mono text-label uppercase text-ink-muted';

export default function ContactForm({ defaultSubject = '' }: { defaultSubject?: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const shownAt = useRef(0);
  useEffect(() => { shownAt.current = Date.now(); }, []);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? '');
    start(async () => {
      const r = await submitEnquiry({ name: get('name'), email: get('email'), subject: get('subject'), message: get('message'), website: get('website'), ts: shownAt.current });
      if ('error' in r) setError(r.error);
      else setDone(true);
    });
  };

  if (done) {
    return (
      <div role="status" className="border border-line bg-bg-secondary p-5">
        <p className="text-h2 font-semibold">Message received</p>
        <p className="mt-3 max-w-[48ch] text-small text-ink-muted">Thank you. Your enquiry has been recorded and will be read directly. A confirmation is sent to your email address when email delivery is available.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div><label className={label} htmlFor="name">Name</label><input id="name" name="name" required maxLength={100} autoComplete="name" className={field} /></div>
        <div><label className={label} htmlFor="email">Email</label><input id="email" name="email" type="email" required maxLength={254} autoComplete="email" className={field} /></div>
      </div>
      <div><label className={label} htmlFor="subject">Subject <span className="normal-case tracking-normal">(optional)</span></label><input id="subject" name="subject" maxLength={150} defaultValue={defaultSubject} className={field} /></div>
      <div><label className={label} htmlFor="message">Message</label><textarea id="message" name="message" required rows={8} maxLength={5000} className={field} /></div>

      {/* Honeypot: invisible to people and assistive technology, tempting to bots. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Magnetic as="span" className="inline-block"><button type="submit" disabled={pending} className="border border-brand-blue bg-brand-blue px-6 py-3 text-small font-medium transition-colors hover:bg-transparent disabled:opacity-40">{pending ? 'Sending' : 'Send enquiry'}</button></Magnetic>
        {error && <p role="alert" className="text-small text-danger">{error}</p>}
      </div>
      <p className="text-small text-ink-muted">Your details are used only to reply to this enquiry.</p>
    </form>
  );
}
