import 'server-only';
import { ABOUT } from '../../content/about';
import { PROCESS, SERVICES, SKILLS, STACK } from '../../content/site';
import { listAllPublicDocsForChat, type PublicCorpusDoc } from '../docs';
import { listPublicForChat } from '../projects';
import { CATEGORY_LABEL, STATUS_LABEL, VISIBILITY_LABEL, type Product } from '../products';
import { Bm25 } from './bm25';
import { chunkMarkdown, type Chunk } from './chunk';
import { redactSecrets } from './safety';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Corpus { chunks: Chunk[]; index: Bm25; byId: Map<string, Chunk> }

function build(raw: Chunk[]): Corpus {
  // Every chunk is secret-redacted before it can reach an index or a prompt.
  const chunks = raw.map((c, i) => ({ ...c, id: `${c.url}~${i}`, text: redactSecrets(c.text).text }));
  return { chunks, index: new Bm25(chunks.map((c) => ({ id: c.id, title: c.title, text: c.text }))), byId: new Map(chunks.map((c) => [c.id, c])) };
}
const add = (out: Chunk[], base: Omit<Chunk, 'text' | 'id'>, md: string) => { for (const t of chunkMarkdown(md)) out.push({ ...base, id: '', text: t }); };

/* ------------------------------ public (chatbot) ------------------------------ */
const TTL_MS = 5 * 60_000;
let cache: { at: number; corpus: Corpus } | null = null;

/** Public products and published documentation of public projects only. */
export function buildPublicCorpus(products: Product[], docs: PublicCorpusDoc[]): Corpus {
  const out: Chunk[] = [];
  add(out, { title: 'About HAMXELL CORE', url: '/about', kind: 'about' }, ABOUT.identity.join('\n\n'));
  const capabilities = [
    'These are publicly described services and areas of work, not a list of existing products.',
    ...SERVICES.map((service) => `${service.title}: ${service.text} ${service.points.join('; ')}.`),
    `Publicly described skills: ${SKILLS.join(', ')}.`,
    `Technologies named on the homepage: ${STACK.join(', ')}.`,
    `Public process: ${PROCESS.map((step) => `${step.title}: ${step.text}`).join(' ')}`,
  ].join('\n\n');
  add(out, { title: 'What HAMXELL CORE builds', url: '/', kind: 'capabilities' }, capabilities);
  const publicProducts = products.filter((p) => !p.placeholder && p.visibility === 'public');
  add(out, { title: 'Public product directory', url: '/products', kind: 'directory' }, publicProducts.length
    ? `Current public directory listings:\n\n${publicProducts.map((p) => `${p.name} (${CATEGORY_LABEL[p.category ?? 'product']}; ${STATUS_LABEL[p.status]}): ${p.summary}`).join('\n\n')}`
    : 'No individual product listings are currently available in the public directory.');
  for (const p of publicProducts) {
    const category = p.category ? CATEGORY_LABEL[p.category] : 'Product';
    const facts = [`${p.name}. ${p.summary}`, `Category: ${category}.`, p.description ?? '', `Status: ${STATUS_LABEL[p.status]}.`, p.tags.length ? `Technology: ${p.tags.join(', ')}.` : '', p.licenceType ? `Licence: ${p.licenceType}.` : ''].filter(Boolean).join('\n\n');
    add(out, { title: p.name, url: `/products/${p.slug}`, kind: 'product' }, facts);
  }
  add(out, { title: 'Public documentation directory', url: '/docs', kind: 'directory' }, docs.length
    ? `Published documentation pages:\n\n${docs.map((d) => `${d.projectName}: ${d.title}`).join('\n\n')}`
    : 'No published documentation pages are currently available in the public directory.');
  for (const d of docs) add(out, { title: `${d.projectName}: ${d.title}`, url: `/docs/${d.slug}#${d.kind}`, kind: 'doc' }, d.md);
  return build(out);
}

/** Public products and published documentation of public projects only. Cached for 5 minutes per server instance. */
export async function getPublicCorpus(): Promise<Corpus> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.corpus;
  const [products, docs] = await Promise.all([listPublicForChat(), listAllPublicDocsForChat()]);
  const corpus = buildPublicCorpus(products, docs);
  cache = { at: Date.now(), corpus };
  return cache.corpus;
}

export async function retrievePublic(question: string, k = 5): Promise<Chunk[]> {
  const c = await getPublicCorpus();
  const matches = c.index.search(question, k).map((h) => c.byId.get(h.id)!).filter(Boolean);
  const context = c.chunks.filter((chunk) => chunk.kind === 'about' || chunk.kind === 'capabilities');
  const missingContext = context
    .filter((chunk) => !matches.some((match) => match.id === chunk.id))
    .map((chunk) => ({ ...chunk, contextOnly: true }));
  return [...matches, ...missingContext];
}

/* --------------------- private (admin Knowledge Engine) ---------------------- */
/**
 * All project records visible to the signed-in admin: projects (every visibility), documentation drafts included, infrastructure notes,
 * recent deployments and domains. `sb` is the admin's own session client, so database policies apply (editors cannot read infrastructure notes).
 * Identity fields of the infrastructure record are excluded, and nothing here reads the credentials vault.
 */
export async function buildAdminCorpus(sb: any): Promise<Corpus> {
  const [projects, docs, infra, deps, domains] = await Promise.all([
    sb.from('projects').select('*'),
    sb.from('documentation_docs').select('project_id, kind, title, content_md, status'),
    sb.from('project_infra').select('project_id, hosting, db_provider, deploy_platform, env_var_names, api_key_refs, config_notes, recovery_steps'),
    sb.from('deployments').select('project_id, version, environment, status, platform, deployed_at').order('deployed_at', { ascending: false }).limit(200),
    sb.from('domains').select('domain, registrar, host, expires_on, auto_renew, project_id'),
  ]);
  const name = new Map<string, string>((projects.data ?? []).map((p: any) => [p.id, p.name]));
  const out: Chunk[] = [];
  for (const p of projects.data ?? []) {
    const facts = [`${p.name} (${p.slug}). ${p.summary ?? ''}`, p.description ?? '', `Category: ${p.category ?? 'product'}. Status: ${STATUS_LABEL[p.status as keyof typeof STATUS_LABEL] ?? p.status}. Visibility: ${VISIBILITY_LABEL[p.visibility as keyof typeof VISIBILITY_LABEL] ?? p.visibility}.${p.featured ? ' Featured.' : ''}`,
      p.tags?.length ? `Technology: ${p.tags.join(', ')}.` : '', p.launch_url ? `Website: ${p.launch_url}` : '', p.licence_type ? `Licence: ${p.licence_type}.` : ''].filter(Boolean).join('\n\n');
    add(out, { title: p.name, url: `/admin/projects/${p.id}`, kind: 'project' }, facts);
  }
  for (const d of docs.data ?? []) add(out, { title: `${name.get(d.project_id) ?? 'Project'}: ${d.title} (${d.status})`, url: `/admin/projects/${d.project_id}/docs/${d.kind}`, kind: 'doc' }, d.content_md);
  for (const i of infra.data ?? []) {
    const t = [`Hosting: ${i.hosting ?? 'not recorded'}`, `Database provider: ${i.db_provider ?? 'not recorded'}`, `Deploy platform: ${i.deploy_platform ?? 'not recorded'}`, `Environment variable names: ${(i.env_var_names ?? []).join(', ') || 'none recorded'}`,
      `API key references: ${(i.api_key_refs ?? []).join('; ') || 'none recorded'}`, i.config_notes ? `Configuration notes:\n${i.config_notes}` : '', i.recovery_steps ? `Recovery steps:\n${i.recovery_steps}` : ''].filter(Boolean).join('\n\n');
    add(out, { title: `${name.get(i.project_id) ?? 'Project'}: infrastructure`, url: `/admin/vault/${i.project_id}`, kind: 'infra' }, t);
  }
  const byProject = new Map<string, string[]>();
  for (const d of deps.data ?? []) (byProject.get(d.project_id) ?? byProject.set(d.project_id, []).get(d.project_id)!).push(`${d.version} to ${d.environment} on ${new Date(d.deployed_at).toISOString().slice(0, 10)}: ${d.status}${d.platform ? ` (${d.platform})` : ''}`);
  for (const [pid, lines] of byProject) add(out, { title: `${name.get(pid) ?? 'Project'}: deployments`, url: '/admin/deployments', kind: 'deployment' }, `Recent deployments:\n\n${lines.map((l) => `- ${l}`).join('\n')}`);
  for (const d of domains.data ?? []) add(out, { title: `Domain ${d.domain}`, url: '/admin/domains', kind: 'domain' }, `${d.domain}${d.project_id ? ` belongs to ${name.get(d.project_id) ?? 'a project'}` : ''}. Registrar: ${d.registrar ?? 'not recorded'}. Host: ${d.host ?? 'not recorded'}. Expires: ${d.expires_on ?? 'not recorded'}. Auto-renew: ${d.auto_renew ? 'yes' : 'no'}.`);
  return build(out);
}
