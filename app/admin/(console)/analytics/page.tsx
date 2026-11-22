import { requireAdmin } from '@/lib/auth';
import { flag } from '@/lib/flags';
import { summarise, type EventRow } from '@/lib/analytics';
import { cached } from '@/lib/db/redis';
import { getDb, mongoConfigured } from '@/lib/db/mongo';
import { createClient } from '@/lib/supabase/server';

const PAGE = 1000, MAX_PAGES = 20;

function grade(v: number | null, good: number, poor: number) {
  if (v === null) return { label: 'No data', tone: 'text-ink-muted' };
  return v <= good ? { label: 'Good', tone: 'text-success' } : v <= poor ? { label: 'Needs work', tone: 'text-warning' } : { label: 'Poor', tone: 'text-danger' };
}

export default async function AnalyticsPage({ searchParams }: { searchParams: { days?: string } }) {
  await requireAdmin();
  if (!flag('FEATURE_ANALYTICS_DASHBOARD')) {
    return <div><h1 className="text-h1 font-semibold">Analytics</h1><p className="mt-4 border border-line p-5 text-small text-ink-muted">Coming soon. Set FEATURE_ANALYTICS_DASHBOARD=true to enable.</p></div>;
  }
  const days = searchParams.days === '30' ? 30 : 7;
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const sb = createClient();

  type Row = EventRow & { created_at: string };
  const LIMIT = PAGE * MAX_PAGES;
  const rows: Row[] = [];
  let capped = false;
  const fromMongo = mongoConfigured();
  if (fromMongo) {
    // Hot store: events from the last 30 days (older ones are archived to TiDB). Cached for 60 seconds.
    const docs = await cached<Row[]>(`analytics:${days}`, 60, async () => {
      const found = await (await getDb()).collection('analytics_events').find({ createdAt: { $gte: new Date(since) } }, { projection: { _id: 0, type: 1, path: 1, referrer_host: 1, device: 1, lcp_ms: 1, cls: 1, ttfb_ms: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(LIMIT + 1).toArray();
      return found.map((d) => ({ type: d.type, path: d.path, referrer_host: d.referrer_host ?? null, device: d.device ?? null, lcp_ms: d.lcp_ms ?? null, cls: d.cls ?? null, ttfb_ms: d.ttfb_ms ?? null, created_at: new Date(d.createdAt).toISOString() }));
    });
    capped = docs.length > LIMIT;
    rows.push(...docs.slice(0, LIMIT));
  }
  // Fallback store (Supabase): PostgREST returns at most 1000 rows per request, so page through the window (capped).
  for (let i = 0; !fromMongo && i < MAX_PAGES; i++) {
    const { data } = await sb.from('analytics_events').select('type, path, referrer_host, device, lcp_ms, cls, ttfb_ms, created_at').gte('created_at', since).order('created_at', { ascending: false }).range(i * PAGE, i * PAGE + PAGE - 1);
    rows.push(...((data ?? []) as (EventRow & { created_at: string })[]));
    if (!data || data.length < PAGE) break;
    if (i === MAX_PAGES - 1) capped = true;
  }
  const s = summarise(rows, days);
  const peak = Math.max(1, ...s.daily.map((d) => d.views));
  const lcp = grade(s.vitals.lcp, 2500, 4000), ttfb = grade(s.vitals.ttfb, 800, 1800), cls = grade(s.vitals.cls, 0.1, 0.25);

  const List = ({ title, items }: { title: string; items: { key: string; views: number }[] }) => (
    <section>
      <h2 className="font-mono text-label uppercase text-ink-muted">{title}</h2>
      <ul className="mt-3 divide-y divide-line border-y border-line text-small">
        {items.map((i) => <li key={i.key} className="flex justify-between gap-4 py-2"><span className="break-all font-mono">{i.key}</span><span className="font-mono text-ink-muted">{i.views}</span></li>)}
        {items.length === 0 && <li className="py-2 text-ink-muted">No data yet.</li>}
      </ul>
    </section>
  );

  return (
    <div className="max-w-[56rem]">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-h1 font-semibold">Analytics</h1>
        <p className="flex gap-4 font-mono text-label uppercase">
          <a href="?days=7" className={days === 7 ? 'text-ink' : 'text-ink-muted hover:text-ink'}>7 days</a>
          <a href="?days=30" className={days === 30 ? 'text-ink' : 'text-ink-muted hover:text-ink'}>30 days</a>
        </p>
      </div>
      <p className="mt-2 max-w-[62ch] text-small text-ink-muted">Cookieless and read-only. No IP addresses or visitor identifiers are stored, so these are page views, not unique visitors. Visitors with Do Not Track or Global Privacy Control are not counted.</p>
      {capped && <p className="mt-3 border border-warning p-3 text-small text-warning">More than {PAGE * MAX_PAGES} events in this window: figures cover the most recent {PAGE * MAX_PAGES}.</p>}

      <p className="mt-6 font-mono text-h1 font-semibold">{s.views.toLocaleString('en-GB')} <span className="font-sans text-small font-normal text-ink-muted">page views, last {days} days</span></p>
      <div className="mt-4 flex h-[8rem] items-end gap-[2px] border-b border-line" role="img" aria-label="Page views per day">
        {s.daily.map((d) => <div key={d.day} title={`${d.day}: ${d.views}`} className="min-w-0 flex-1 bg-brand-blue" style={{ height: `${Math.max(2, (d.views / peak) * 100)}%` }} />)}
      </div>
      <p className="mt-1 flex justify-between font-mono text-label uppercase text-ink-muted"><span>{s.daily[0]?.day}</span><span>{s.daily.at(-1)?.day}</span></p>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <List title="Top pages" items={s.pages} />
        <List title="Referrers" items={s.referrers} />
        <List title="Devices" items={s.devices} />
        <section>
          <h2 className="font-mono text-label uppercase text-ink-muted">Performance (75th percentile, {s.vitals.samples} samples)</h2>
          <dl className="mt-3 divide-y divide-line border-y border-line text-small">
            {[['Largest contentful paint', s.vitals.lcp === null ? 'n/a' : `${Math.round(s.vitals.lcp)} ms`, lcp], ['Time to first byte', s.vitals.ttfb === null ? 'n/a' : `${Math.round(s.vitals.ttfb)} ms`, ttfb], ['Layout shift', s.vitals.cls === null ? 'n/a' : s.vitals.cls.toFixed(3), cls]].map(([k, v, g]) => (
              <div key={k as string} className="flex justify-between gap-4 py-2"><dt>{k as string}</dt><dd className="font-mono">{v as string} <span className={(g as { tone: string }).tone}>{(g as { label: string }).label}</span></dd></div>
            ))}
          </dl>
          <p className="mt-2 text-small text-ink-muted">Measured on each visit&apos;s first page load. Thresholds follow Google&apos;s Core Web Vitals guidance.</p>
        </section>
      </div>
    </div>
  );
}
