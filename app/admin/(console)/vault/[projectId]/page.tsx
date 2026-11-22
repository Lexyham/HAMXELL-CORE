import Link from 'next/link';
import { notFound } from 'next/navigation';
import SecretReveal from '@/components/admin/SecretReveal';
import { BTN, BTN_DANGER, BTN_GHOST, FIELD, LABEL, Notice } from '@/components/admin/ui';
import { requireOwner } from '@/lib/auth';
import { flag } from '@/lib/flags';
import { createClient } from '@/lib/supabase/server';
import { addSecret, deleteSecret, rotateSecret, saveInfra } from '../actions';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProjectVault({ params, searchParams }: { params: { projectId: string }; searchParams: { error?: string; ok?: string } }) {
  await requireOwner();
  if (!flag('FEATURE_CREDENTIALS_VAULT') || !UUID.test(params.projectId)) notFound();
  const sb = createClient();
  const { data: project } = await sb.from('projects').select('id, name').eq('id', params.projectId).maybeSingle();
  if (!project) notFound();
  const [{ data: infra }, { data: entries }] = await Promise.all([
    sb.from('project_infra').select('*').eq('project_id', project.id).maybeSingle(),
    // Listing never selects ciphertext, iv or tag.
    sb.from('vault_entries').select('id, label, kind, updated_at, last_revealed_at').eq('project_id', project.id).order('created_at'),
  ]);
  const i = infra ?? {};

  return (
    <div className="max-w-[48rem]">
      <Link href="/admin/vault" className="font-mono text-label uppercase text-ink-muted hover:text-ink">Vault</Link>
      <h1 className="mt-4 text-h1 font-semibold">{project.name}</h1>
      <Notice error={searchParams.error} ok={searchParams.ok} />

      <section className="mt-8" aria-labelledby="sec-h">
        <h2 id="sec-h" className="font-mono text-label uppercase text-ink-muted">Secrets</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {(entries ?? []).map((e) => (
            <li key={e.id} className="py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-body font-medium">{e.label}</span>
                <span className="font-mono text-label uppercase text-ink-muted">{e.kind} / {e.last_revealed_at ? `last revealed ${new Date(e.last_revealed_at).toLocaleDateString('en-GB')}` : 'never revealed'}</span>
              </div>
              <SecretReveal entryId={e.id} label={e.label} />
              <details className="mt-3">
                <summary className="cursor-pointer font-mono text-label uppercase text-ink-muted">Rotate or delete</summary>
                <form action={rotateSecret} className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <input type="hidden" name="id" value={e.id} /><input type="hidden" name="project_id" value={project.id} />
                  <input name="value" type="password" required maxLength={8192} placeholder="New value" autoComplete="new-password" className={FIELD} />
                  <button type="submit" className={`${BTN_GHOST} sm:mt-2 sm:shrink-0`}>Replace value</button>
                </form>
                <form action={deleteSecret} className="mt-3">
                  <input type="hidden" name="id" value={e.id} /><input type="hidden" name="project_id" value={project.id} />
                  <button type="submit" className={BTN_DANGER}>Delete secret</button>
                </form>
              </details>
            </li>
          ))}
          {(entries ?? []).length === 0 && <li className="py-4 text-small text-ink-muted">No secrets stored.</li>}
        </ul>

        <form action={addSecret} className="mt-6 grid gap-5 border border-line p-5">
          <input type="hidden" name="project_id" value={project.id} />
          <p className={LABEL}>Add a secret</p>
          <div className="grid gap-5 sm:grid-cols-[1fr_12rem]">
            <div><label className={LABEL} htmlFor="label">Label</label><input id="label" name="label" required maxLength={100} placeholder="Production database password" className={FIELD} /></div>
            <div><label className={LABEL} htmlFor="kind">Type</label>
              <select id="kind" name="kind" className={FIELD}><option value="password">Password</option><option value="api_key">API key</option><option value="token">Token</option><option value="certificate">Certificate</option><option value="other">Other</option></select></div>
          </div>
          <div><label className={LABEL} htmlFor="value">Secret value</label><input id="value" name="value" type="password" required maxLength={8192} autoComplete="new-password" className={FIELD} /></div>
          <button type="submit" className={`${BTN} w-fit`}>Encrypt and store</button>
        </form>
      </section>

      <section className="mt-10" aria-labelledby="infra-h">
        <h2 id="infra-h" className="font-mono text-label uppercase text-ink-muted">Infrastructure record</h2>
        <p className="mt-2 max-w-[60ch] text-small text-ink-muted">Non-secret facts only. Record environment variable names and where a key is kept, never the value.</p>
        <form action={saveInfra} className="mt-4 grid gap-5">
          <input type="hidden" name="project_id" value={project.id} />
          <div className="grid gap-5 sm:grid-cols-2">
            <div><label className={LABEL} htmlFor="admin_url">Admin URL</label><input id="admin_url" name="admin_url" type="url" defaultValue={i.admin_url ?? ''} className={FIELD} /></div>
            <div><label className={LABEL} htmlFor="username">Admin username</label><input id="username" name="username" defaultValue={i.username ?? ''} className={FIELD} /></div>
            <div><label className={LABEL} htmlFor="hosting">Hosting</label><input id="hosting" name="hosting" defaultValue={i.hosting ?? ''} className={FIELD} /></div>
            <div><label className={LABEL} htmlFor="db_provider">Database provider</label><input id="db_provider" name="db_provider" defaultValue={i.db_provider ?? ''} className={FIELD} /></div>
            <div><label className={LABEL} htmlFor="deploy_platform">Deploy platform</label><input id="deploy_platform" name="deploy_platform" defaultValue={i.deploy_platform ?? ''} className={FIELD} /></div>
          </div>
          <div><label className={LABEL} htmlFor="env_var_names">Environment variable names</label><textarea id="env_var_names" name="env_var_names" rows={2} defaultValue={(i.env_var_names ?? []).join(', ')} className={`${FIELD} font-mono text-small`} /></div>
          <div><label className={LABEL} htmlFor="api_key_refs">API key references (one per line)</label><textarea id="api_key_refs" name="api_key_refs" rows={3} defaultValue={(i.api_key_refs ?? []).join('\n')} className={FIELD} /></div>
          <div><label className={LABEL} htmlFor="config_notes">Configuration notes</label><textarea id="config_notes" name="config_notes" rows={4} defaultValue={i.config_notes ?? ''} className={FIELD} /></div>
          <div><label className={LABEL} htmlFor="recovery_steps">Recovery steps</label><textarea id="recovery_steps" name="recovery_steps" rows={4} defaultValue={i.recovery_steps ?? ''} className={FIELD} /></div>
          <button type="submit" className={`${BTN} w-fit`}>Save record</button>
        </form>
      </section>
    </div>
  );
}
