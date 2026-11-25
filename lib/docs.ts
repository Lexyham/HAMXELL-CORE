import 'server-only';
import { DOC_KINDS, type DocKind } from './ai/prompts/docs';
import { publicClient } from './projects';
import { PublicDataUnavailableError } from './rag/errors';
import { supabaseConfigured } from './supabase/config';
import { cached } from './db/redis';

export interface PublicDoc { kind: DocKind; title: string; md: string; updatedAt: string }
export interface DocProject { slug: string; name: string; summary: string }
export interface PublicCorpusDoc { slug: string; projectName: string; kind: string; title: string; md: string }

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const order = (k: string) => DOC_KINDS.indexOf(k as DocKind);

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Projects that have at least one published document. Public projects only. */
export async function listDocProjects(): Promise<(DocProject & { count: number })[]> {
  if (!supabaseConfigured()) return [];
  return cached('public-doc-projects', 60, async () => {
    const { data, error } = await publicClient()
      .from('documentation_docs')
      .select('projects!inner(slug, name, summary, visibility)')
      .eq('status', 'published')
      .eq('projects.visibility', 'public');
    if (error) {
      console.error('listDocProjects', error.message);
      return [];
    }
    const map = new Map<string, DocProject & { count: number }>();
    for (const r of (data ?? []) as any[]) {
      const p = r.projects;
      if (!p) continue;
      const cur = map.get(p.slug) ?? { slug: p.slug, name: p.name, summary: p.summary ?? '', count: 0 };
      cur.count++;
      map.set(p.slug, cur);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  });
}

export async function getProjectDocs(slug: string): Promise<{ project: DocProject; docs: PublicDoc[] } | null> {
  if (!supabaseConfigured() || !SLUG.test(slug) || slug.length > 60) return null;
  return cached(`public-docs:${slug}`, 60, async () => {
    const { data, error } = await publicClient()
      .from('documentation_docs')
      .select('kind, title, content_md, updated_at, projects!inner(slug, name, summary, visibility)')
      .eq('status', 'published')
      .eq('projects.slug', slug)
      .eq('projects.visibility', 'public');
    if (error) console.error('getProjectDocs', error.message);
    const rows = (data ?? []) as any[];
    if (rows.length === 0) return null;
    const p = rows[0].projects;
    return {
      project: { slug: p.slug, name: p.name, summary: p.summary ?? '' },
      docs: rows
        .map((r) => ({ kind: r.kind as DocKind, title: r.title as string, md: r.content_md as string, updatedAt: r.updated_at as string }))
        .sort((a, b) => order(a.kind) - order(b.kind)),
    };
  });
}

/** Every published document of every public project (used to build the chatbot's knowledge). */
export async function listAllPublicDocs(): Promise<{ slug: string; projectName: string; kind: string; title: string; md: string }[]> {
  if (!supabaseConfigured()) return [];
  const { data, error } = await publicClient()
    .from('documentation_docs')
    .select('kind, title, content_md, projects!inner(slug, name, visibility)')
    .eq('status', 'published')
    .eq('projects.visibility', 'public');
  if (error) { console.error('listAllPublicDocs', error.message); return []; }
  return ((data ?? []) as any[]).map((r) => ({ slug: r.projects.slug, projectName: r.projects.name, kind: r.kind, title: r.title, md: r.content_md }));
}

/** Strict published-document read for the chatbot; no published rows is a valid empty directory. */
export async function listAllPublicDocsForChat(): Promise<PublicCorpusDoc[]> {
  if (!supabaseConfigured()) throw new PublicDataUnavailableError('documentation');
  const { data, error } = await publicClient()
    .from('documentation_docs')
    .select('kind, title, content_md, projects!inner(slug, name, visibility)')
    .eq('status', 'published')
    .eq('projects.visibility', 'public');
  if (error) {
    console.error('listAllPublicDocsForChat', error.message);
    throw new PublicDataUnavailableError('documentation');
  }
  if (data === null) throw new PublicDataUnavailableError('documentation');
  return (data as any[]).map((r) => ({
    slug: r.projects.slug,
    projectName: r.projects.name,
    kind: r.kind,
    title: r.title,
    md: r.content_md,
  }));
}
