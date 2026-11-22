'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { AiError } from '@/lib/ai/types';
import { generate } from '@/lib/ai/client';
import { projectContext } from '@/lib/ai/context';
import { DOC_KINDS, DOC_TITLE, DOCS_PROMPT_VERSION, DOCS_SYSTEM, docPrompt, type DocKind } from '@/lib/ai/prompts/docs';
import { requireAdmin } from '@/lib/auth';
import { flag } from '@/lib/flags';
import type { ImportResult } from '@/lib/importer';
import { fromRow } from '@/lib/projects';
import { rateLimit } from '@/lib/rate-limit';
import { snapshotDoc } from '@/lib/docs-versions';
import { createClient } from '@/lib/supabase/server';

export async function generateDocs(fd: FormData) {
  const { user, email } = await requireAdmin();
  const id = String(fd.get('id') ?? '');
  const back = `/admin/projects/${id}/docs`;
  const stop = (m: string): never => redirect(`${back}?error=${encodeURIComponent(m)}`);

  if (!flag('FEATURE_AI_DOC_GENERATOR')) stop('The AI documentation generator is switched off.');
  if (!(await rateLimit(`docs:${user.id}`, 5, 60 * 60 * 1000))) stop('Generation limit reached (5 per hour). Try again later.');

  const kinds = DOC_KINDS.filter((k) => fd.getAll('kind').includes(k));
  if (kinds.length === 0) stop('Select at least one document.');

  const sb = createClient();
  const { data: row } = await sb.from('projects').select('*').eq('id', id).maybeSingle();
  if (!row) stop('Project not found.');
  const project = fromRow(row!);

  // Use the latest import for this project's website, when one exists, as extra (labelled) context.
  let imp: ImportResult | null = null;
  if (project.launchUrl) {
    const { data } = await sb.from('project_imports').select('result').eq('result->>finalUrl', project.launchUrl).order('created_at', { ascending: false }).limit(1).maybeSingle();
    imp = (data?.result as ImportResult) ?? null;
  }
  const context = projectContext(project, imp);

  const { data: existing } = await sb.from('documentation_docs').select('kind, source, status').eq('project_id', id);
  const protectedKinds = new Set((existing ?? []).filter((d) => d.source === 'manual' || d.status === 'published').map((d) => d.kind));
  const todo = kinds.filter((k) => !protectedKinds.has(k));

  const results = await Promise.allSettled(
    todo.map(async (kind: DocKind) => {
      const r = await generate({ task: 'docs', system: DOCS_SYSTEM, prompt: docPrompt(kind, context), promptVersion: DOCS_PROMPT_VERSION, maxTokens: 2500, actorId: user.id });
      await snapshotDoc(sb, id, kind, user.id); // keep what is being replaced
      const { error } = await sb.from('documentation_docs').upsert(
        { project_id: id, kind, title: DOC_TITLE[kind], content_md: r.text, source: 'ai', status: 'draft', provider: r.provider, model: r.model, prompt_version: DOCS_PROMPT_VERSION, created_by: user.id },
        { onConflict: 'project_id,kind' },
      );
      if (error) throw new Error('save failed');
      return { kind, provider: r.provider };
    }),
  );

  const ok = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  const failed = results.length - ok.length;
  const aiErr = results.find((r) => r.status === 'rejected' && r.reason instanceof AiError) as PromiseRejectedResult | undefined;
  await logActivity({ actorId: user.id, actorEmail: email, action: 'docs.generate', entity: 'project', entityId: id, meta: { generated: ok, failed, skipped: kinds.length - todo.length } });

  const q = new URLSearchParams({ done: String(ok.length), failed: String(failed), skipped: String(kinds.length - todo.length) });
  if (aiErr) q.set('error', (aiErr.reason as AiError).message);
  redirect(`${back}?${q}`);
}

const MAX_CHARS = 100_000;

/** Studio save: always becomes a manual document, so AI regeneration can never overwrite human edits. */
export async function saveDoc(fd: FormData) {
  const { user, email } = await requireAdmin();
  const id = String(fd.get('id') ?? '');
  const kind = String(fd.get('kind') ?? '') as DocKind;
  const back = `/admin/projects/${id}/docs/${kind}`;
  const fail = (m: string): never => redirect(`${back}?error=${encodeURIComponent(m)}`);

  if (!DOC_KINDS.includes(kind)) redirect(`/admin/projects/${id}/docs`);
  const content = String(fd.get('content') ?? '').replace(/\r\n/g, '\n');
  const status = fd.get('status') === 'published' ? 'published' : 'draft';
  const title = String(fd.get('title') ?? '').trim().slice(0, 120) || DOC_TITLE[kind];
  if (!content.trim()) fail('The document cannot be empty.');
  if (content.length > MAX_CHARS) fail(`The document is too long (limit ${MAX_CHARS.toLocaleString('en-GB')} characters).`);

  const sb = createClient();
  const { data: before } = await sb.from('documentation_docs').select('status').eq('project_id', id).eq('kind', kind).maybeSingle();
  await snapshotDoc(sb, id, kind, user.id); // keep the previous state so this save can be undone
  const { error } = await sb.from('documentation_docs').upsert(
    { project_id: id, kind, title, content_md: content, source: 'manual', status },
    { onConflict: 'project_id,kind' },
  );
  if (error) fail('Could not save the document.');

  const action = status === 'published' && before?.status !== 'published' ? 'docs.publish' : before?.status === 'published' && status === 'draft' ? 'docs.unpublish' : 'docs.save';
  await logActivity({ actorId: user.id, actorEmail: email, action, entity: 'project', entityId: id, meta: { kind, status, chars: content.length } });
  revalidatePath('/', 'layout');
  redirect(`/admin/projects/${id}/docs?saved=${kind}`);
}

/** Restores a saved version as the current draft (never straight to published). The state being replaced is saved first. */
export async function restoreDocVersion(fd: FormData) {
  const { user, email } = await requireAdmin();
  const vid = String(fd.get('version') ?? '');
  if (!/^\d{1,18}$/.test(vid)) redirect('/admin');
  const sb = createClient();
  const { data: v } = await sb.from('documentation_versions').select('project_id, kind, title, content_md').eq('id', vid).maybeSingle();
  if (!v) redirect('/admin');
  const back = `/admin/projects/${v!.project_id}/docs/${v!.kind}`;
  await snapshotDoc(sb, v!.project_id, v!.kind, user.id);
  const { error } = await sb.from('documentation_docs').upsert({ project_id: v!.project_id, kind: v!.kind, title: v!.title, content_md: v!.content_md, source: 'manual', status: 'draft' }, { onConflict: 'project_id,kind' });
  if (error) redirect(`${back}?error=${encodeURIComponent('Could not restore that version.')}`);
  await logActivity({ actorId: user.id, actorEmail: email, action: 'docs.restore', entity: 'project', entityId: v!.project_id, meta: { kind: v!.kind, version: vid } });
  revalidatePath('/', 'layout');
  redirect(`${back}?restored=1`);
}
