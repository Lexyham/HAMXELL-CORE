import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BTN_GHOST, Notice } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/auth';
import type { ImportResult } from '@/lib/importer';
import { createClient } from '@/lib/supabase/server';
import { createDraft, regenerateDescription } from '../actions';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ImportResultPage({ params, searchParams }: { params: { id: string }; searchParams: { error?: string } }) {
  await requireAdmin();
  if (!UUID.test(params.id)) notFound();
  const { data } = await createClient().from('project_imports').select('result').eq('id', params.id).maybeSingle();
  if (!data) notFound();
  const r = data.result as ImportResult;
  const d = r.description;

  return (
    <div className="max-w-[60rem]">
      <Link href="/admin/importer" className="font-mono text-label uppercase text-ink-muted hover:text-ink">Importer</Link>
      <h1 className="mt-4 text-h1 font-semibold">{r.observed.title || r.finalUrl}</h1>
      <p className="mt-2 break-all text-small text-ink-muted">{r.finalUrl}</p>
      <Notice error={searchParams.error} />

      {d ? (
        <section className="mt-6 border border-line p-6">
          <p className="font-mono text-label uppercase text-ink-muted">About this website</p>
          <p className="mt-3 text-h2 font-semibold">{d.tagline}</p>
          <div className="mt-4 space-y-4 text-body">
            {d.text.split(/\n\n+/).map((para, i) => <p key={i}>{para}</p>)}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <p className="text-small text-ink-muted">
              {d.source === 'ai'
                ? `Written with AI assistance (${d.provider}) from the public pages. It uses only what the pages show and may still contain mistakes.`
                : `Assembled automatically from the public pages. ${d.note ?? ''}`}
            </p>
            <form action={regenerateDescription}><input type="hidden" name="id" value={params.id} /><button type="submit" className={BTN_GHOST}>Write again</button></form>
          </div>
        </section>
      ) : (
        <form action={regenerateDescription} className="mt-6 border border-line p-5">
          <input type="hidden" name="id" value={params.id} />
          <p className="text-small text-ink-muted">This import has no written description yet.</p>
          <button type="submit" className={`${BTN_GHOST} mt-3`}>Write description</button>
        </form>
      )}

      {r.repoError && <p className="mt-4 text-small text-ink-muted">The repository could not be read: {r.repoError}</p>}
      {r.crawl?.truncatedCrawl && <p className="mt-2 text-small text-ink-muted">The review stopped early at its time limit, so the description may not cover every page.</p>}

      <form action={createDraft} className="mt-10 border-t border-line pt-6">
        <input type="hidden" name="id" value={params.id} />
        <button type="submit" className="border border-brand-blue bg-brand-blue px-6 py-3 text-small font-medium hover:bg-transparent">Create private draft project</button>
        <p className="mt-2 text-small text-ink-muted">The draft is created as private and in development. Review it before publishing.</p>
      </form>
    </div>
  );
}
