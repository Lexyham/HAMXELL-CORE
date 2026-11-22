'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { askKnowledge } from '@/app/admin/(console)/knowledge/actions';
import { BTN, FIELD } from './ui';

interface Msg { role: 'user' | 'assistant'; content: string; sources?: { title: string; url: string }[]; by?: string }

export default function KnowledgeChat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [msgs, pending]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = q.trim();
    if (!text || pending) return;
    const history = msgs.map(({ role, content }) => ({ role, content }));
    setMsgs((m) => [...m, { role: 'user', content: text }]); setQ(''); setError(null);
    start(async () => {
      const r = await askKnowledge(text, history);
      if ('error' in r) setError(r.error);
      else setMsgs((m) => [...m, { role: 'assistant', content: r.answer, sources: r.sources, by: r.provider === 'none' ? undefined : `${r.provider} / ${r.model}` }]);
    });
  };

  return (
    <div>
      <div className="space-y-5 border-y border-line py-5">
        {msgs.length === 0 && <p className="text-small text-ink-muted">Ask about projects, documentation, hosting, deployments or domains. Answers come only from your records, and credentials are never available here.</p>}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'border-l-2 border-brand-blue pl-3' : ''}>
            <p className="font-mono text-label uppercase text-ink-muted">{m.role === 'user' ? 'You' : `Knowledge Engine${m.by ? ` / ${m.by}` : ''}`}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-body">{m.content}</p>
            {m.sources && m.sources.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-small">
                {m.sources.map((s) => <li key={s.url}><Link href={s.url} className="border-b border-brand-gold text-ink-muted hover:text-ink">{s.title}</Link></li>)}
              </ul>
            )}
          </div>
        ))}
        {pending && <p className="font-mono text-label uppercase text-ink-muted">Searching records</p>}
        <div ref={end} />
      </div>
      {error && <p role="alert" className="mt-4 text-small text-danger">{error}</p>}
      <form onSubmit={submit} className="mt-5">
        <label htmlFor="kq" className="block font-mono text-label uppercase text-ink-muted">Question</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <textarea id="kq" value={q} onChange={(e) => setQ(e.target.value)} rows={2} maxLength={1000} className={`${FIELD} resize-y`} />
          <button type="submit" disabled={pending || !q.trim()} className={`${BTN} sm:mt-2 sm:shrink-0 sm:self-start`}>{pending ? 'Searching' : 'Ask'}</button>
        </div>
      </form>
    </div>
  );
}
