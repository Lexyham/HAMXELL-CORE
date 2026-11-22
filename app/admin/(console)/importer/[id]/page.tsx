import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BTN_GHOST, Notice } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/auth';
import type { ImportResult } from '@/lib/importer';
import { summarise } from '@/lib/importer/report';
import { renderMarkdown } from '@/lib/markdown';
import { createClient } from '@/lib/supabase/server';
import { addNarrative, createDraft } from '../actions';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ImportReportPage({ params, searchParams }: { params: { id: string }; searchParams: { error?: string } }) {
  await requireAdmin();
  if (!UUID.test(params.id)) notFound();
  const { data } = await createClient().from('project_imports').select('result').eq('id', params.id).maybeSingle();
  if (!data) notFound();
  const r = data.result as ImportResult;
  const s = r.findings ? summarise(r.findings) : null;
  const stat = (label: string, v: number, tone = '') => <div className="border border-line px-4 py-3"><p className={`font-mono text-h2 font-semibold ${tone}`}>{v}</p><p className="font-mono text-label uppercase text-ink-muted">{label}</p></div>;

  return (
    <div className="max-w-[60rem]">
      <Link href="/admin/importer" className="font-mono text-label uppercase text-ink-muted hover:text-ink">Importer</Link>
      <h1 className="mt-4 text-h1 font-semibold">{r.observed.title || r.finalUrl}</h1>
      <p className="mt-2 break-all text-small text-ink-muted">{r.finalUrl}</p>
      <Notice error={searchParams.error} />

      {s && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stat('High priority', s.high, s.high ? 'text-danger' : '')}
          {stat('Medium', s.medium, s.medium ? 'text-warning' : '')}
          {stat('Low', s.low)}
          {stat('Passed', s.pass, 'text-success')}
        </div>
      )}

      {r.reportMd ? (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="font-mono text-label uppercase text-ink-muted">Download report</span>
            {(['pdf', 'html', 'md'] as const).map((f) => <a key={f} href={`/admin/importer/${params.id}/report?format=${f}`} download className={BTN_GHOST}>{f === 'md' ? 'Markdown' : f.toUpperCase()}</a>)}
            {!r.aiNarrative && (
              <form action={addNarrative}><input type="hidden" name="id" value={params.id} /><button type="submit" className={BTN_GHOST}>Add AI-written summary</button></form>
            )}
          </div>
          {r.aiNarrative && <p className="mt-3 text-small text-ink-muted">An AI-assisted summary and closing note ({r.aiNarrative.provider}) are included, labelled as such. The findings themselves are produced by fixed checks, not by AI.</p>}
          <article className="doc mt-8 border-t border-line pt-6 !max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(r.reportMd) }} />
        </>
      ) : (
        <p className="mt-6 border border-warning p-4 text-small text-warning">This import was made before the audit report existed, so it has no report. Run the analysis again on the same address to produce one.</p>
      )}

      <form action={createDraft} className="mt-10 border-t border-line pt-6">
        <input type="hidden" name="id" value={params.id} />
        <button type="submit" className="border border-brand-blue bg-brand-blue px-6 py-3 text-small font-medium hover:bg-transparent">Create private draft project</button>
        <p className="mt-2 text-small text-ink-muted">The draft is created as private and in development. Review it before publishing.</p>
      </form>
    </div>
  );
}
