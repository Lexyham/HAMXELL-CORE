'use client';

import { useState, useTransition } from 'react';
import { addAdmin } from '@/app/admin/(console)/settings/actions';
import { BTN, FIELD, LABEL } from './ui';

export default function AddAdminForm() {
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget, fd = new FormData(form);
    setError(null); setResult(null);
    start(async () => {
      const r = await addAdmin(String(fd.get('email') ?? ''), String(fd.get('role') ?? ''));
      if ('error' in r) setError(r.error); else { setResult(r); form.reset(); }
    });
  };
  return (
    <div>
      <form onSubmit={submit} className="grid gap-5 sm:grid-cols-[1fr_11rem_auto] sm:items-end">
        <div><label className={LABEL} htmlFor="admin-email">Email</label><input id="admin-email" name="email" type="email" required className={FIELD} /></div>
        <div><label className={LABEL} htmlFor="admin-role">Role</label><select id="admin-role" name="role" className={FIELD} defaultValue="editor"><option value="editor">Editor</option><option value="owner">Owner</option></select></div>
        <button type="submit" disabled={pending} className={`${BTN} sm:mb-0`}>{pending ? 'Creating' : 'Add admin'}</button>
      </form>
      {error && <p role="alert" className="mt-3 text-small text-danger">{error}</p>}
      {result && (
        <div role="status" className="mt-4 border border-warning p-4 text-small">
          <p className="font-medium">Account created for {result.email}</p>
          <p className="mt-2 text-ink-muted">Temporary password (shown once, copy it now and share it securely):</p>
          <code className="mt-2 block break-all bg-bg-secondary p-3 font-mono text-body">{result.tempPassword}</code>
          <p className="mt-2 text-ink-muted">At first sign-in they must set up an authenticator app and choose their own password.</p>
        </div>
      )}
    </div>
  );
}
