'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { revealSecret } from '@/app/admin/(console)/vault/actions';
import { BTN_GHOST, FIELD } from './ui';

const SECONDS = 30;

/**
 * Re-authenticated reveal. The secret lives only in component state: it is hidden again after 30 seconds,
 * and anything copied to the clipboard is cleared after 30 seconds (or when you leave the page).
 */
export default function SecretReveal({ entryId, label }: { entryId: string; label: string }) {
  const [asking, setAsking] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const copiedValue = useRef<string | null>(null);
  const clipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearClipboard = async () => {
    const mine = copiedValue.current;
    if (mine === null) return;
    copiedValue.current = null;
    setCopied(false);
    try {
      const now = await navigator.clipboard.readText();
      if (now === mine) await navigator.clipboard.writeText('');
    } catch {
      try { await navigator.clipboard.writeText(''); } catch { /* clipboard unavailable */ }
    }
  };

  // 30 second countdown, then hide
  useEffect(() => {
    if (secret === null) return;
    setLeft(SECONDS);
    const iv = setInterval(() => setLeft((n) => n - 1), 1000);
    return () => clearInterval(iv);
  }, [secret]);
  useEffect(() => {
    if (secret !== null && left <= 0) { setSecret(null); setVisible(false); }
  }, [left, secret]);

  // clear the clipboard if the user navigates away
  useEffect(() => () => {
    if (clipTimer.current) clearTimeout(clipTimer.current);
    void clearClipboard();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const pw = String(new FormData(e.currentTarget).get('confirm') ?? '');
    start(async () => {
      const r = await revealSecret(entryId, pw);
      if ('error' in r) { setError(r.error); return; }
      setError(null); setAsking(false); setSecret(r.secret); setVisible(false);
    });
  };

  const copy = async () => {
    if (secret === null) return;
    try {
      await navigator.clipboard.writeText(secret);
      copiedValue.current = secret;
      setCopied(true);
      if (clipTimer.current) clearTimeout(clipTimer.current);
      clipTimer.current = setTimeout(() => void clearClipboard(), SECONDS * 1000);
    } catch { setError('Could not access the clipboard.'); }
  };

  if (secret !== null) {
    return (
      <div className="mt-3 border border-line bg-bg-secondary p-3">
        <code className="block break-all font-mono text-small">{visible ? secret : '\u2022'.repeat(Math.min(secret.length, 24))}</code>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className={BTN_GHOST} onClick={() => setVisible((v) => !v)}>{visible ? 'Hide' : 'Show'}</button>
          <button type="button" className={BTN_GHOST} onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
          <button type="button" className={BTN_GHOST} onClick={() => { setSecret(null); setVisible(false); void clearClipboard(); }}>Close</button>
          <span className="font-mono text-label uppercase text-ink-muted">Hides in {Math.max(left, 0)}s{copied ? ' / clipboard clears in 30s' : ''}</span>
        </div>
      </div>
    );
  }

  if (!asking) {
    return <button type="button" className={`${BTN_GHOST} mt-3`} onClick={() => { setAsking(true); setError(null); }}>Reveal</button>;
  }

  return (
    <form onSubmit={submit} className="mt-3">
      <label htmlFor={`pw-${entryId}`} className="block font-mono text-label uppercase text-ink-muted">Confirm your password to reveal {label}</label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input id={`pw-${entryId}`} name="confirm" type="password" autoComplete="current-password" required autoFocus className={FIELD} />
        <button type="submit" disabled={pending} className={`${BTN_GHOST} sm:mt-2 sm:shrink-0`}>{pending ? 'Checking' : 'Confirm'}</button>
        <button type="button" onClick={() => setAsking(false)} className={`${BTN_GHOST} sm:mt-2 sm:shrink-0`}>Cancel</button>
      </div>
      {error && <p role="alert" className="mt-2 text-small text-danger">{error}</p>}
    </form>
  );
}
