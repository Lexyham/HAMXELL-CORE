'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */
const optedOut = () => navigator.doNotTrack === '1' || (navigator as any).globalPrivacyControl === true;

function send(data: unknown) {
  try {
    const body = JSON.stringify(data);
    if (navigator.sendBeacon?.('/api/collect', new Blob([body], { type: 'application/json' }))) return;
    void fetch('/api/collect', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(() => {});
  } catch { /* analytics must never break the page */ }
}

/** Cookieless page views plus first-load Core Web Vitals. Honours Do Not Track and Global Privacy Control. Never loaded in the control centre. */
export default function Analytics() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (optedOut()) return;
    send({ t: 'view', path: pathname, ref: first.current ? document.referrer : '', w: window.innerWidth });
    first.current = false;
  }, [pathname]);

  useEffect(() => {
    if (optedOut() || !('PerformanceObserver' in window)) return;
    let lcp = 0, cls = 0, sent = false;
    const observers: PerformanceObserver[] = [];
    try {
      const o = new PerformanceObserver((l) => { const e = l.getEntries(); lcp = e[e.length - 1].startTime; });
      o.observe({ type: 'largest-contentful-paint', buffered: true });
      observers.push(o);
    } catch { /* unsupported */ }
    try {
      const o = new PerformanceObserver((l) => { for (const e of l.getEntries() as any[]) if (!e.hadRecentInput) cls += e.value; });
      o.observe({ type: 'layout-shift', buffered: true });
      observers.push(o);
    } catch { /* unsupported */ }
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const path = location.pathname;
    const flush = () => {
      if (sent) return;
      sent = true;
      send({ t: 'vitals', path, lcp: lcp || undefined, cls, ttfb: nav?.responseStart || undefined, w: window.innerWidth });
    };
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      observers.forEach((o) => o.disconnect());
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  return null;
}
