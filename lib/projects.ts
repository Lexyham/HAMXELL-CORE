import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { PLACEHOLDERS, type Category, type Product, type Visibility } from './products';
import { PublicDataUnavailableError } from './rag/errors';
import { serviceClient } from './supabase/admin';
import { supabaseConfigured } from './supabase/config';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const fromRow = (r: any): Product => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  summary: r.summary ?? '',
  description: r.description ?? '',
  status: r.status,
  visibility: r.visibility,
  category: r.category ?? 'product',
  tags: r.tags ?? [],
  launchUrl: r.launch_url,
  warningText: r.warning_text,
  licenceType: r.licence_type,
  licenceText: r.licence_text,
  licenceUrl: r.licence_url,
  featured: r.featured,
});

export const publicClient = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
    global: { fetch: (url, init) => fetch(url, { ...init, cache: 'no-store' }) }, // never serve stale project data
  });

/** Directory data: public projects only (RLS enforces this as well). */
export async function listPublic(opts: { limit?: number; category?: Category } = {}): Promise<Product[]> {
  if (!supabaseConfigured()) return PLACEHOLDERS.filter((p) => !opts.category || p.category === opts.category).slice(0, opts.limit);
  let q = publicClient()
    .from('projects')
    .select('*')
    .eq('visibility', 'public')
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false });
  if (opts.category) q = q.eq('category', opts.category);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) {
    console.error('listPublic', error.message);
    return [];
  }
  return (data ?? []).map(fromRow);
}

/** Strict public directory read for the chatbot: an empty result is valid, but an unavailable database is not. */
export async function listPublicForChat(): Promise<Product[]> {
  if (!supabaseConfigured()) throw new PublicDataUnavailableError('products');
  const { data, error } = await publicClient()
    .from('projects')
    .select('*')
    .eq('visibility', 'public')
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    console.error('listPublicForChat', error.message);
    throw new PublicDataUnavailableError('products');
  }
  if (data === null) throw new PublicDataUnavailableError('products');
  return data.map(fromRow);
}

/**
 * Fetch one project, and only if it has exactly the visibility the calling route serves.
 * "private" is never returned here: private projects are admin-only.
 */
export async function getBySlug(slug: string, visibility: Exclude<Visibility, 'private'>): Promise<Product | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 60) return null;
  if (!supabaseConfigured()) return visibility === 'public' ? (PLACEHOLDERS.find((p) => p.slug === slug) ?? null) : null;
  const sb = visibility === 'public' ? publicClient() : serviceClient(); // RLS hides unlisted/warning from anon
  const { data, error } = await sb.from('projects').select('*').eq('slug', slug).eq('visibility', visibility).maybeSingle();
  if (error) console.error('getBySlug', error.message);
  return data ? fromRow(data) : null;
}

/** True when a warning-gated project also requires a password. Only this boolean ever reaches a page. */
export async function gateRequired(slug: string): Promise<boolean> {
  if (!supabaseConfigured() || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return false;
  const sb = serviceClient();
  const { data: p } = await sb.from('projects').select('id').eq('slug', slug).eq('visibility', 'warning').maybeSingle();
  if (!p) return false;
  const { data: g } = await sb.from('project_gates').select('project_id').eq('project_id', p.id).maybeSingle();
  return Boolean(g);
}

/** The stored password hash for a warning-gated project, for server-side verification only. */
export async function getGateHash(slug: string): Promise<string | null> {
  if (!supabaseConfigured() || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  const sb = serviceClient();
  const { data: p } = await sb.from('projects').select('id').eq('slug', slug).eq('visibility', 'warning').maybeSingle();
  if (!p) return null;
  const { data: g } = await sb.from('project_gates').select('password_hash').eq('project_id', p.id).maybeSingle();
  return g?.password_hash ?? null;
}
