import { DOC_KINDS, type DocKind } from '@/lib/ai/prompts/docs';
import { getProjectDocs } from '@/lib/docs';
import { exportResponse, parseFormat } from '@/lib/docs/export';

export const dynamic = 'force-dynamic';

/** Public export of a PUBLISHED document of a PUBLIC project. Anything else is a plain 404. */
export async function GET(req: Request, { params }: { params: { slug: string; kind: string } }) {
  const format = parseFormat(new URL(req.url).searchParams.get('format'));
  if (!format || !DOC_KINDS.includes(params.kind as DocKind)) return new Response('Not found', { status: 404 });
  const r = await getProjectDocs(params.slug);
  const doc = r?.docs.find((d) => d.kind === params.kind);
  if (!r || !doc) return new Response('Not found', { status: 404 });
  return exportResponse(format, { title: doc.title, project: r.project.name, slug: r.project.slug, kind: doc.kind, md: doc.md, updated: doc.updatedAt });
}
