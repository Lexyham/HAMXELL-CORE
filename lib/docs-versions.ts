/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Saves the CURRENT state of a document as a version, just before it is changed, so edits, AI regeneration and restores can all be undone.
 * Skips the write when the current state is identical to the latest saved version.
 */
export async function snapshotDoc(sb: any, projectId: string, kind: string, userId?: string): Promise<void> {
  const { data: d } = await sb.from('documentation_docs').select('id, title, content_md, source, status').eq('project_id', projectId).eq('kind', kind).maybeSingle();
  if (!d) return;
  const { data: last } = await sb.from('documentation_versions').select('title, content_md, status').eq('project_id', projectId).eq('kind', kind).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (last && last.content_md === d.content_md && last.title === d.title && last.status === d.status) return;
  await sb.from('documentation_versions').insert({ doc_id: d.id, project_id: projectId, kind, title: d.title, content_md: d.content_md, source: d.source, status: d.status, saved_by: userId ?? null });
}
