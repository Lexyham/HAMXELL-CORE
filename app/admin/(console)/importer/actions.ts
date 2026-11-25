'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { requireAdmin } from '@/lib/auth';
import { flag } from '@/lib/flags';
import { analyzeSiteDetailed, CrawlError, type ImportResult } from '@/lib/importer';
import { describeSite } from '@/lib/importer/describe-ai';
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

  // The audit stays behind the scenes; the written description is what the person reads first.
  const aiOn = flag('FEATURE_AI_DOC_GENERATOR');
  const aiOk = aiOn && (await rateLimit(`describe:${user.id}`, 30, 60 * 60 * 1000));
  result!.description = await describeSite(result!, { ai: aiOk, actorId: user.id, reason: aiOn ? 'The hourly limit for AI descriptions was reached.' : 'AI features are switched off.' });

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

  const d = r.description;
  const name = (r.observed.title || new URL(r.finalUrl).hostname).slice(0, 120);
  const base = slugify(name);
  const record = {
    name,
    summary: (d?.summary || r.observed.description).slice(0, 240),
    description: `${d?.text || r.observed.description}\n\nImported from ${r.finalUrl} on ${r.fetchedAt.slice(0, 10)}.${d ? ` The description was written from the public pages${d.source === 'ai' ? ' with AI assistance' : ''}.` : ''} Technology details were inferred from the public pages and should be verified.`.trim(),
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

/** Writes the description again from the stored crawl, for example after AI was switched on or a provider was down. Findings are untouched. */
export async function regenerateDescription(fd: FormData) {
  const { user, email } = await requireAdmin();
  const id = String(fd.get('id') ?? '');
  const back = `/admin/importer/${id}`;
  const stop = (m: string): never => redirect(`${back}?error=${encodeURIComponent(m)}`);
  if (!(await rateLimit(`describe:${user.id}`, 30, 60 * 60 * 1000))) stop('Limit reached. Try again later.');

  const sb = createClient();
  const { data: row } = await sb.from('project_imports').select('result').eq('id', id).maybeSingle();
  if (!row) redirect('/admin/importer');
  const r = row!.result as ImportResult;

  const aiOn = flag('FEATURE_AI_DOC_GENERATOR');
  const description = await describeSite(r, { ai: aiOn, actorId: user.id, reason: 'AI features are switched off.' });
  const { error } = await sb.from('project_imports').update({ result: { ...r, description } }).eq('id', id);
  if (error) stop('The new description could not be saved.');
  await logActivity({ actorId: user.id, actorEmail: email, action: 'import.describe', entity: 'import', entityId: id, meta: { source: description.source, provider: description.provider ?? null } });
  redirect(back);
}
