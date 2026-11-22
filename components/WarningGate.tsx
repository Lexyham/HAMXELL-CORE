'use client';

import { useState, useTransition } from 'react';
import { revealProject, type Revealed } from '@/app/(public)/p/[slug]/actions';
import Reveal from './Reveal';

const DEFAULT_WARNING =
  'This project is experimental or unreviewed. It is provided as is, without warranty. Continue only if you understand the risks.';

export default function WarningGate(props: { slug: string; name: string; statusLabel: string; summary: string; warningText: string | null; needsPassword: boolean }) {
  const [ack, setAck] = useState(false);
  const [data, setData] = useState<Revealed | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [pending, start] = useTransition();

  const reveal = () =>
    start(async () => {
      const r = await revealProject(props.slug, props.needsPassword ? pw : undefined);
      if (r && 'error' in r) setFailed(r.error);
      else if (r) setData(r);
      else setFailed('This project is not available.');
    });

  return (
    <article className="mx-auto grid w-full max-w-page gap-7 px-[var(--gutter)] pb-8 pt-7 lg:grid-cols-12">
      <Reveal scroll={false} className="lg:col-span-8">
        <p className="font-mono text-label uppercase text-warning">Notice / {props.statusLabel}</p>
        <h1 className="mt-5 text-h1 font-semibold">{props.name}</h1>
        <p className="mt-4 max-w-[54ch] text-body text-ink">{props.summary}</p>

        {!data ? (
          <div className="mt-6 max-w-[62ch] border border-line bg-bg-secondary p-5">
            <p className="text-small text-ink-muted">{props.warningText || DEFAULT_WARNING}</p>
            <label className="mt-5 flex cursor-pointer items-start gap-3 text-small">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1 h-[16px] w-[16px] accent-[var(--brand-blue)]" />
              <span>I have read this notice and want to continue.</span>
            </label>
            {props.needsPassword && (
              <div className="mt-5">
                <label htmlFor="gate-pw" className="block font-mono text-label uppercase text-ink-muted">Access password</label>
                <input id="gate-pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" className="mt-2 w-full max-w-[20rem] border border-line bg-bg px-3 py-2 text-body text-ink focus:border-brand-blue focus:outline-none" />
              </div>
            )}
            <button
              type="button"
              disabled={!ack || pending || (props.needsPassword && !pw)}
              onClick={reveal}
              className="mt-5 border border-brand-blue bg-brand-blue px-5 py-3 text-small font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? 'Loading' : 'Continue'}
            </button>
            {failed && <p role="alert" className="mt-3 text-small text-danger">{failed}</p>}
          </div>
        ) : (
          <div>
            {data.description
              .split(/\n{2,}/)
              .filter(Boolean)
              .map((t, i) => (
                <p key={i} className="mt-4 max-w-[62ch] text-body text-ink-muted">{t}</p>
              ))}
            {data.launchUrl && (
              <a href={data.launchUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex border border-brand-blue bg-brand-blue px-5 py-3 text-small font-medium hover:bg-transparent">
                Launch project
              </a>
            )}
            {data.licenceType && <p className="mt-5 font-mono text-label uppercase text-ink-muted">Licence: {data.licenceType}</p>}
          </div>
        )}
      </Reveal>
    </article>
  );
}
