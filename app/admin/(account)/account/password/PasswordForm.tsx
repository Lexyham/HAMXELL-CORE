'use client';

import { useState, useTransition } from 'react';
import { BTN, FIELD, LABEL } from '@/components/admin/ui';
import { changePassword } from './actions';

export default function PasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const a = String(fd.get('next') ?? ''), b = String(fd.get('confirm') ?? '');
    if (a !== b) return setError('The two new passwords do not match.');
    start(async () => { const r = await changePassword(String(fd.get('current') ?? ''), a); if (r && 'error' in r) setError(r.error); });
  };
  return (
    <form onSubmit={submit} className="grid gap-5">
      <div><label className={LABEL} htmlFor="current">Current password</label><input id="current" name="current" type="password" required autoComplete="current-password" className={FIELD} /></div>
      <div><label className={LABEL} htmlFor="next">New password</label><input id="next" name="next" type="password" required minLength={12} autoComplete="new-password" className={FIELD} /><p className="mt-1 text-small text-ink-muted">At least 12 characters. Do not include your email name.</p></div>
      <div><label className={LABEL} htmlFor="confirm">Repeat the new password</label><input id="confirm" name="confirm" type="password" required autoComplete="new-password" className={FIELD} /></div>
      <button type="submit" disabled={pending} className={`${BTN} w-fit`}>{pending ? 'Saving' : 'Change password'}</button>
      {error && <p role="alert" className="text-small text-danger">{error}</p>}
    </form>
  );
}
