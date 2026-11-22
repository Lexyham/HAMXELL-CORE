import Link from 'next/link';
import { notFound } from 'next/navigation';
import DocEditor from '@/components/admin/DocEditor';
import { DOC_KINDS, DOC_TITLE, type DocKind } from '@/lib/ai/prompts/docs';
import { requireAdmin } from '@/lib/auth';
import { BTN_GHOST } from '@/components/admin/ui';
import { createClient } from '@/lib/supabase/server';
import { restoreDocVersion } from '../actions';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DocStudioPage({ params, searchParams }: { params: { id: string; kind: string }; searchParams: { error?: string; restored?: string } }) {
  await requireAdmin();
  if (!UUID.test(params.id) || !DOC_KINDS.includes(params.kind as DocKind)) notFound();
  const kind = params.kind as DocKind;
  const sb = createClient();
  const { data: project } = await sb.from('projects').select('id, name, visibility').eq('id', params.id).maybeSingle();
  if (!project) notFound();
  const { data: doc } = await sb.from('documentation_docs').select('title, content_md, status, source').eq('project_id', params.id).eq('kind', kind).maybeSingle();

  const { data: versions } = await sb.from('documentation_versions').select('id, created_at, source, status, title, content_md').eq('project_id', params.id).eq('kind', kind).order('created_at', { ascending: false }).limit(20);
  const days = process.env.ARCHIVE_AGE_DAYS ?? '30';
  return (
    <div className="max-w-[80rem]">
      <Link href={`/admin/projects/${project.id}/docs`} className="font-mono text-label uppercase text-ink-muted hover:text-ink">{project.name} / Documentation</Link>
      <h1 className="mt-4 text-h1 font-semibold">{DOC_TITLE[kind]}</h1>
      {searchParams.error && <p role="alert" className="mt-4 text-small text-danger">{searchParams.error}</p>}
      {searchParams.restored && <p role="status" className="mt-4 text-small text-success">Version restored as a draft.</p>}
      <div className="mt-6">
        <DocEditor
          projectId={project.id}
          kind={kind}
          projectIsPublic={project.visibility === 'public'}
          fromAi={doc?.source === 'ai'}
          initial={{ title: doc?.title ?? DOC_TITLE[kind], content: doc?.content_md ?? `# ${DOC_TITLE[kind]}\n\n`, status: doc?.status === 'published' ? 'published' : 'draft' }}
        />
      </div>
      <section className="mt-10 max-w-[56rem]" aria-labelledby="hist-h">
        <h2 id="hist-h" className="font-mono text-label uppercase text-ink-muted">Version history</h2>
        <p className="mt-2 text-small text-ink-muted">Each save, AI regeneration or restore keeps the previous state. Versions older than {days} days are moved to the archive.</p>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {(versions ?? []).map((v) => (
            <li key={v.id} className="py-3">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-small">
                  <span className="font-mono">{new Date(v.created_at).toLocaleString('en-GB')}</span>
                  <span className="font-mono text-label uppercase text-ink-muted">{v.source === 'ai' ? 'AI draft' : 'Manual'} / {v.status} / {v.content_md.length.toLocaleString('en-GB')} characters</span>
                </summary>
                <pre className="mt-3 max-h-[20rem] max-w-full overflow-auto whitespace-pre-wrap break-words bg-bg-secondary p-4 font-mono text-small text-ink-muted">{v.content_md}</pre>
                <form action={restoreDocVersion} className="mt-3"><input type="hidden" name="version" value={String(v.id)} /><button type="submit" className={BTN_GHOST}>Restore as draft</button></form>
              </details>
            </li>
          ))}
          {(versions ?? []).length === 0 && <li className="py-3 text-small text-ink-muted">No earlier versions yet.</li>}
        </ul>
      </section>
    </div>
  );
}
