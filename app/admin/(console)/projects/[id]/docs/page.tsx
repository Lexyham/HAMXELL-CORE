import Link from 'next/link';
import { notFound } from 'next/navigation';
import { configuredProviders, ROUTES } from '@/lib/ai/client';
import { MODELS } from '@/lib/ai/providers';
import { DOC_KINDS, DOC_TITLE } from '@/lib/ai/prompts/docs';
import { requireAdmin } from '@/lib/auth';
import { flag } from '@/lib/flags';
import { createClient } from '@/lib/supabase/server';
import { generateDocs } from './actions';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProjectDocsPage({ params, searchParams }: { params: { id: string }; searchParams: { error?: string; done?: string; failed?: string; skipped?: string; saved?: string } }) {
  await requireAdmin();
  if (!UUID.test(params.id)) notFound();
  const sb = createClient();
  const { data: project } = await sb.from('projects').select('id, name').eq('id', params.id).maybeSingle();
  if (!project) notFound();
  const { data: docs } = await sb.from('documentation_docs').select('*').eq('project_id', params.id).order('kind');

  const enabled = flag('FEATURE_AI_DOC_GENERATOR');
  const providers = configuredProviders();
  const usable = ROUTES.docs.filter((p) => providers.includes(p));
  const s = searchParams;

  return (
    <div className="max-w-[56rem]">
      <Link href={`/admin/projects/${project.id}`} className="font-mono text-label uppercase text-ink-muted hover:text-ink">{project.name}</Link>
      <h1 className="mt-4 text-h1 font-semibold">Documentation</h1>

      {!enabled ? (
        <p className="mt-4 border border-line p-5 text-small text-ink-muted">Coming soon. Set FEATURE_AI_DOC_GENERATOR=true to enable.</p>
      ) : (
        <form action={generateDocs} className="mt-6 border border-line p-5">
          <input type="hidden" name="id" value={project.id} />
          <p className="font-mono text-label uppercase text-ink-muted">Generate drafts</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {DOC_KINDS.map((k) => (
              <li key={k}>
                <label className="flex items-center gap-3 text-small">
                  <input type="checkbox" name="kind" value={k} defaultChecked className="h-[16px] w-[16px] accent-[var(--brand-blue)]" />
                  {DOC_TITLE[k]}
                </label>
              </li>
            ))}
          </ul>
          <button type="submit" disabled={usable.length === 0} className="mt-5 border border-brand-blue bg-brand-blue px-6 py-3 text-small font-medium hover:bg-transparent disabled:opacity-40">Generate</button>
          <p className="mt-3 text-small text-ink-muted">
            {usable.length > 0
              ? `Order: ${usable.map((p) => `${p} (${MODELS[p]()})`).join(' then ')}. Only project fields on the allowlist are sent; credentials never are. Published or manually edited documents are not overwritten.`
              : 'No AI provider key is set. Add GEMINI_API_KEY, GROQ_API_KEY or OPENROUTER_API_KEY to .env.'}
          </p>
        </form>
      )}

      {s.done !== undefined && <p role="status" className="mt-4 text-small text-success">{s.done} generated{s.skipped !== '0' ? `, ${s.skipped} skipped (published or manual)` : ''}{s.failed !== '0' ? `, ${s.failed} failed` : ''}.</p>}
      {s.error && <p role="alert" className="mt-4 text-small text-danger">{s.error}</p>}

      {s.saved && <p role="status" className="mt-4 text-small text-success">Saved.</p>}

      <div className="mt-8 divide-y divide-line border-y border-line">
        {DOC_KINDS.map((k) => {
          const d = (docs ?? []).find((x) => x.kind === k);
          return (
            <div key={k} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-small">
                  <span className="font-medium">{DOC_TITLE[k]}</span>
                  {d ? (
                    <>
                      <span className={`border px-2 py-[2px] font-mono text-label uppercase ${d.status === 'published' ? 'border-success text-success' : 'border-warning text-warning'}`}>{d.status}</span>
                      <span className="font-mono text-label uppercase text-ink-muted">{d.source === 'ai' ? `AI draft / ${d.provider} / ${d.prompt_version}` : 'Manual'}</span>
                    </>
                  ) : (
                    <span className="font-mono text-label uppercase text-ink-muted">Not written</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4 font-mono text-label uppercase">
                  <Link href={`/admin/projects/${project.id}/docs/${k}`} className="border border-line px-3 py-2 hover:border-ink">{d ? 'Edit' : 'Write'}</Link>
                  {d && (['md', 'html', 'pdf'] as const).map((f) => (
                    <a key={f} href={`/admin/projects/${project.id}/docs/${k}/export?format=${f}`} className="text-ink-muted hover:text-brand-gold" download>{f}</a>
                  ))}
                </div>
              </div>
              {d && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-small text-ink-muted">Preview</summary>
                  <pre className="mt-3 max-w-full overflow-x-auto whitespace-pre-wrap break-words bg-bg-secondary p-4 font-mono text-small text-ink-muted">{d.content_md}</pre>
                </details>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-small text-ink-muted">AI drafts must be reviewed before publishing. Editing a document marks it as manual, so regeneration will not overwrite it.</p>
    </div>
  );
}
