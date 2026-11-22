import { DOC_KINDS, type DocKind } from '@/lib/ai/prompts/docs';
import { requireAdmin } from '@/lib/auth';
import { exportResponse, parseFormat } from '@/lib/docs/export';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Admin export of any document, drafts included. */
export async function GET(req: Request, { params }: { params: { id: string; kind: string } }) {
  await requireAdmin();
  const format = parseFormat(new URL(req.url).searchParams.get('format'));
  if (!format || !UUID.test(params.id) || !DOC_KINDS.includes(params.kind as DocKind)) return new Response('Not found', { status: 404 });
  const sb = createClient();
  const { data: doc } = await sb.from('documentation_docs').select('title, content_md, kind, updated_at, projects(slug, name)').eq('project_id', params.id).eq('kind', params.kind).maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (doc as any)?.projects as { slug: string; name: string } | undefined;
  if (!doc || !p) return new Response('Not found', { status: 404 });
  return exportResponse(format, { title: doc.title, project: p.name, slug: p.slug, kind: doc.kind, md: doc.content_md, updated: doc.updated_at });
}
