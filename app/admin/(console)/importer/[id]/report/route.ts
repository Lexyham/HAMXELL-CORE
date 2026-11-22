import { requireAdmin } from '@/lib/auth';
import { exportResponse, parseFormat } from '@/lib/docs/export';
import type { ImportResult } from '@/lib/importer';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Download the audit report as Markdown, HTML or PDF. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  const format = parseFormat(new URL(req.url).searchParams.get('format'));
  if (!format || !UUID.test(params.id)) return new Response('Not found', { status: 404 });
  const { data } = await createClient().from('project_imports').select('result').eq('id', params.id).maybeSingle();
  const r = data?.result as ImportResult | undefined;
  if (!r?.reportMd) return new Response('Not found', { status: 404 });
  const host = new URL(r.finalUrl).hostname;
  return exportResponse(format, { title: 'Website Audit Report', project: host, slug: host, kind: 'audit-report', md: r.reportMd });
}
