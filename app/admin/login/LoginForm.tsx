'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { signIn, verifyTotp, type SignInResult } from './actions';

type Step = { kind: 'credentials' } | Exclude<SignInResult, { error: string }>;
const input = 'mt-2 w-full border border-line bg-bg-secondary px-3 py-3 text-body text-ink focus:border-brand-blue focus:outline-none';
const label = 'block font-mono text-label uppercase text-ink-muted';
const button = 'mt-6 w-full border border-brand-blue bg-brand-blue px-5 py-3 text-small font-medium disabled:opacity-40';

export default function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: 'credentials' });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onCredentials = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await signIn(String(fd.get('email') ?? ''), String(fd.get('password') ?? ''));
      if ('error' in r) setError(r.error);
      else {
        setError(null);
        setStep(r);
      }
    });
  };

  const onCode = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step.kind === 'credentials') return;
    const code = String(new FormData(e.currentTarget).get('code') ?? '');
    start(async () => {
      const r = await verifyTotp(step.factorId, code);
      if ('error' in r) setError(r.error);
      else {
        router.replace('/admin');
        router.refresh();
      }
    });
  };

  if (!configured) {
    return <p className="border border-line p-5 text-small text-ink-muted">Supabase is not configured. Add the keys to .env.local and restart.</p>;
  }

  return (
    <div>
      {step.kind === 'credentials' ? (
        <form onSubmit={onCredentials}>
          <label className={label} htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="username" className={input} />
          <label className={`${label} mt-5`} htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" className={input} />
          <button type="submit" disabled={pending} className={button}>{pending ? 'Checking' : 'Continue'}</button>
        </form>
      ) : (
        <form onSubmit={onCode}>
          {step.kind === 'enroll' && (
            <div className="mb-6">
              <p className="text-small text-ink-muted">Scan this code with an authenticator app, then enter the 6-digit code to finish setup.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={step.qr} alt="Authenticator QR code" width={176} height={176} className="mt-4 bg-ink p-2" />
              <p className="mt-3 break-all font-mono text-small text-ink-muted">Manual key: {step.secret}</p>
            </div>
          )}
          <label className={label} htmlFor="code">Authenticator code</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,8}" required className={input} />
          <button type="submit" disabled={pending} className={button}>{pending ? 'Verifying' : 'Verify'}</button>
        </form>
      )}
      {error && <p role="alert" className="mt-4 text-small text-danger">{error}</p>}
    </div>
  );
}
