'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { requireAdmin } from '@/lib/auth';
import { flag } from '@/lib/flags';
import { generate } from '@/lib/ai/client';
import { AUDIT_PROMPT_VERSION, AUDIT_SYSTEM, auditPrompt, parseNarrative } from '@/lib/ai/prompts/audit';
import { analyzeSiteDetailed, CrawlError, withNarrative, type ImportResult } from '@/lib/importer';
import { summarise } from '@/lib/importer/report';
import { recordImport } from '@/lib/importer/record';
import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'imported-project';

export async function analyzeUrl(fd: FormData) {
  const { user, email } = await requireAdmin();
  if (!flag('FEATURE_PROJECT_IMPORTER')) redirect('/admin/importer');
  const url = String(fd.get('url') ?? '').trim();
  const fail = (m: string): never => redirect(`/admin/importer?error=${encodeURIComponent(m)}`);

  if (!url) fail('Enter a URL.');
  if (!(await rateLimit(`import:${user.id}`, 10, 60 * 60 * 1000))) fail('Import limit reached. Try again later.');

  let result: ImportResult | null = null;
  let message = '';
  const started = Date.now();
  try {
    const d = await analyzeSiteDetailed(url, { repo: String(fd.get('repo') ?? '') });
    result = d.result;
    await recordImport({ url, status: 'done', ms: Date.now() - started, actorId: user.id, page: d.page });
  } catch (e) {
    message = e instanceof CrawlError ? e.message : 'Analysis failed unexpectedly.';
    await recordImport({ url, status: 'failed', error: message, ms: Date.now() - started, actorId: user.id });
  }
  if (!result) {
    await logActivity({ actorId: user.id, actorEmail: email, action: 'import.failed', entity: 'import', meta: { url: url.slice(0, 300), reason: message } });
    fail(message);
  }

  const { data, error } = await createClient()
    .from('project_imports')
    .insert({ source_url: result!.sourceUrl, result: result, created_by: user.id })
    .select('id')
    .single();
  if (error || !data) fail('Analysis finished but the result could not be saved.');

  await logActivity({ actorId: user.id, actorEmail: email, action: 'import.analyze', entity: 'import', entityId: data!.id, meta: { url: result!.finalUrl } });
  redirect(`/admin/importer/${data!.id}`);
}

/** Turns an import into a PRIVATE draft project. Nothing becomes public without an explicit visibility change. */
export async function createDraft(fd: FormData) {
  const { user, email } = await requireAdmin();
  const importId = String(fd.get('id') ?? '');
  const sb = createClient();
  const { data: row } = await sb.from('project_imports').select('result').eq('id', importId).maybeSingle();
  if (!row) redirect('/admin/importer');
  const r = row!.result as ImportResult;

  const name = (r.observed.title || new URL(r.finalUrl).hostname).slice(0, 120);
  const base = slugify(name);
  const record = {
    name,
    summary: r.observed.description.slice(0, 240),
    description: `${r.observed.description}\n\nImported from ${r.finalUrl} on ${r.fetchedAt.slice(0, 10)}. Technology details were inferred from the public page and should be verified.`.trim(),
    status: 'in_development',
    visibility: 'private',
    tags: r.tech.map((t) => t.name).slice(0, 12),
    launch_url: r.finalUrl,
  };

  for (let i = 0; i < 6; i++) {
    const slug = i === 0 ? base : `${base}-${i === 5 ? Math.random().toString(36).slice(2, 6) : i + 1}`;
    const { data, error } = await sb.from('projects').insert({ ...record, slug }).select('id').single();
    if (!error && data) {
      await logActivity({ actorId: user.id, actorEmail: email, action: 'import.create_draft', entity: 'project', entityId: data.id, meta: { slug, importId } });
      revalidatePath('/', 'layout');
      redirect(`/admin/projects/${data.id}`);
    }
    if (error?.code !== '23505') break;
  }
  redirect(`/admin/importer/${importId}`);
}

/**
 * Optional AI step: the model writes the executive summary and closing note from the structured findings only (never from page HTML),
 * and the report is rewritten with those paragraphs, clearly labelled as AI-assisted. Findings and recommendations are never changed by it.
 */
export async function addNarrative(fd: FormData) {
  const { user, email } = await requireAdmin();
  const id = String(fd.get('id') ?? '');
  const back = `/admin/importer/${id}`;
  const stop = (m: string): never => redirect(`${back}?error=${encodeURIComponent(m)}`);
  if (!flag('FEATURE_AI_DOC_GENERATOR')) stop('AI features are switched off.');
  if (!(await rateLimit(`narrative:${user.id}`, 20, 60 * 60 * 1000))) stop('Limit reached. Try again later.');

  const sb = createClient();
  const { data: row } = await sb.from('project_imports').select('result').eq('id', id).maybeSingle();
  if (!row) redirect('/admin/importer');
  const r = row!.result as ImportResult;
  if (!r.crawl || !r.findings) stop('This import predates the audit report. Run the analysis again to use this.');

  let message = '';
  try {
    const out = await generate({ task: 'import_summary', system: AUDIT_SYSTEM, prompt: auditPrompt({ host: new URL(r.finalUrl).hostname, pages: r.crawl!.pages.length, counts: summarise(r.findings!), findings: r.findings! }), promptVersion: AUDIT_PROMPT_VERSION, maxTokens: 700, actorId: user.id });
    const { summary, conclusion } = parseNarrative(out.text);
    if (!summary) throw new Error('The model returned no summary.');
    const narrative = { summary, conclusion, provider: out.provider, model: out.model };
    const next: ImportResult = { ...withNarrative(r, narrative), aiNarrative: { ...narrative, at: new Date().toISOString() } };
    await sb.from('project_imports').update({ result: next }).eq('id', id);
    await logActivity({ actorId: user.id, actorEmail: email, action: 'import.narrative', entity: 'import', entityId: id, meta: { provider: out.provider } });
  } catch (e) {
    message = e instanceof Error ? e.message : 'Could not write the narrative.';
  }
  redirect(message ? `${back}?error=${encodeURIComponent(message)}` : back);
}
