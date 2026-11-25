'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { IDLE_MS, initialVis, isVisible, onAtTop, onIdle, onOpen, onScroll, type Vis } from '@/lib/chat-visibility';
import { prefersReducedMotion } from '@/lib/gsap';
import { useIntro } from './IntroProvider';

interface Msg { role: 'user' | 'assistant'; content: string; sources?: { title: string; url: string }[] }
const EDGE = { right: 'max(0.75rem, env(safe-area-inset-right))', bottom: 'max(0.75rem, env(safe-area-inset-bottom))' };

/**
 * Floating assistant. The launcher appears on scroll-down and hides on scroll-up (an IntersectionObserver watches a sentinel at
 * the top of the page), and always shows after a 3 second pause. Reduced-motion users always see it, without animation.
 * Answers are plain text and come only from the public site's pages and documentation.
 */
export default function ChatWidget() {
  const { introDone } = useIntro();
  const [vis, setVis] = useState<Vis>(() => initialVis(false));
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);

  useEffect(() => { if (prefersReducedMotion()) setVis((v) => ({ ...v, reduced: true })); }, []);
  useEffect(() => { setVis((v) => onOpen(v, open)); }, [open]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => setVis((v) => onAtTop(v, e.isIntersecting)));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!introDone) return;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => setVis((v) => onIdle(v)), IDLE_MS); };
    const onScrolled = () => { setVis((v) => onScroll(v, window.scrollY)); arm(); };
    arm();
    window.addEventListener('scroll', onScrolled, { passive: true });
    return () => { clearTimeout(timer); window.removeEventListener('scroll', onScrolled); };
  }, [introDone]);

  useEffect(() => {
    if (!open) return;
    box.current?.focus();

    const updateViewport = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0;
      document.documentElement.style.setProperty('--chat-vh', `${Math.round(height)}px`);
      document.documentElement.style.setProperty('--chat-offset-top', `${Math.round(offsetTop)}px`);
    };
    updateViewport();
    window.visualViewport?.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('scroll', updateViewport);
    return () => {
      window.visualViewport?.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('scroll', updateViewport);
    };
  }, [open]);
  useEffect(() => { area.current?.scrollTo({ top: area.current.scrollHeight }); }, [msgs, busy]);

  const close = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => launcher.current?.focus());
  }, []);
  useEffect(() => {
    if (!open) return;

    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;

      const root = dialog.current;
      if (!root) return;
      const focusable = Array.from(root.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), a[href]:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');
      if (focusable.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (
        active === root ||
        active === first ||
        !root.contains(active)
      )) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !root.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const previous = {
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
    };

    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';

    return () => {
      html.style.overflow = previous.htmlOverflow;
      html.style.overscrollBehavior = previous.htmlOverscroll;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.width = previous.bodyWidth;
      body.style.overflow = previous.bodyOverflow;
      body.style.overscrollBehavior = previous.bodyOverscroll;
      window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
    };
  }, [open]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content: text }];
    setMsgs(next); setInput(''); setBusy(true);
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: next.slice(-5).map(({ role, content }) => ({ role, content })) }) });
      const j = (await r.json().catch(() => ({}))) as { answer?: string; sources?: Msg['sources']; error?: string };
      setMsgs([...next, { role: 'assistant', content: r.ok && j.answer ? j.answer : j.error ?? 'Something went wrong. Please try again.', sources: r.ok ? j.sources : undefined }]);
    } catch {
      setMsgs([...next, { role: 'assistant', content: 'I could not connect to the assistant service just now. Your internet connection may still be working; please try again shortly.' }]);
    } finally { setBusy(false); }
  };

  const shown = introDone && isVisible(vis);

  return (
    <>
      {/* Top-of-page sentinel: while it is in view the visitor is at the top of the page. */}
      <div ref={sentinel} aria-hidden className="pointer-events-none absolute left-0 top-0 h-[80px] w-px" />

      <button
        ref={launcher}
        type="button"
        aria-label="Open assistant"
        aria-expanded={open}
        aria-hidden={!(shown && !open)}
        tabIndex={shown && !open ? 0 : -1}
        onClick={() => setOpen(true)}
        style={EDGE}
        className={`fixed z-50 flex h-[3rem] w-[3rem] items-center justify-center border border-line bg-bg-elevated text-ink transition-[opacity,transform,border-color] duration-300 ease-out hover:border-brand-blue motion-reduce:transition-none ${shown && !open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" aria-hidden>
          <path d="M3 4h18v12H9l-6 4z" />
          <path d="M8 9h8M8 12h5" />
        </svg>
      </button>

      {open && (
        <section
          ref={dialog}
          role="dialog"
          aria-modal="true"
          aria-label="HAMXELL CORE assistant"
          aria-labelledby="chat-assistant-title"
          tabIndex={-1}
          style={{
            right: EDGE.right,
            top: 'calc(var(--chat-offset-top, 0px) + var(--chat-vh, 100dvh) - min(32rem, calc(var(--chat-vh, 100dvh) - 1.5rem - env(safe-area-inset-bottom))) - max(0.75rem, env(safe-area-inset-bottom)))',
            width: 'min(24rem, calc(100% - 1.5rem))',
            height: 'min(32rem, calc(var(--chat-vh, 100dvh) - 1.5rem - env(safe-area-inset-bottom)))',
          }}
          className="fixed z-50 flex flex-col border border-line bg-bg-secondary"
        >
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p id="chat-assistant-title" className="font-mono text-label uppercase text-ink-muted">HAMXELL CORE assistant</p>
            <button type="button" onClick={close} aria-label="Close assistant" className="min-h-[44px] border border-line px-3 font-mono text-label uppercase hover:border-ink">Close</button>
          </header>

          <div ref={area} role="log" aria-live="polite" className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-small">
            {msgs.length === 0 && <p className="text-ink-muted">Ask about the public products and documentation of HAMXELL CORE. Answers come only from published pages and can be incomplete.</p>}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'border-l-2 border-brand-blue pl-3' : ''}>
                <p className="font-mono text-label uppercase text-ink-muted">{m.role === 'user' ? 'You' : 'Assistant'}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-ink">{m.content}</p>
                {m.sources && m.sources.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {m.sources.map((s) => <li key={s.url}><a href={s.url} className="border-b border-brand-gold text-ink-muted hover:text-ink">{s.title}</a></li>)}
                  </ul>
                )}
              </div>
            ))}
            {busy && <p className="font-mono text-label uppercase text-ink-muted">Thinking</p>}
          </div>

          <form onSubmit={send} className="border-t border-line p-3">
            <label htmlFor="chat-input" className="sr-only">Your question</label>
            <textarea
              id="chat-input" ref={box} value={input} rows={2} maxLength={1000} disabled={busy}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
              placeholder="Ask a question"
              className="min-h-[48px] w-full resize-none border border-line bg-bg px-3 py-2 text-small text-ink focus:border-brand-blue focus:outline-none"
            />
            <button type="submit" disabled={busy || !input.trim()} className="mt-2 min-h-[44px] w-full border border-brand-blue bg-brand-blue px-4 py-2 text-small font-medium hover:bg-transparent disabled:opacity-40">Send</button>
          </form>
        </section>
      )}
    </>
  );
}
