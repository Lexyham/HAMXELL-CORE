import Link from 'next/link';
import { requireOwner } from '@/lib/auth';
import { flag } from '@/lib/flags';
import { createClient } from '@/lib/supabase/server';
import { Notice, BTN_GHOST } from '@/components/admin/ui';
import { backupVault } from './actions';

export default async function VaultIndex({ searchParams }: { searchParams: { error?: string; ok?: string } }) {
  await requireOwner();
  if (!flag('FEATURE_CREDENTIALS_VAULT')) {
    return (
      <div>
        <h1 className="text-h1 font-semibold">Credentials vault</h1>
        <p className="mt-4 border border-line p-5 text-small text-ink-muted">Coming soon. Set FEATURE_CREDENTIALS_VAULT=true to enable.</p>
      </div>
    );
  }
  const sb = createClient();
  const [{ data: projects }, { data: entries }] = await Promise.all([
    sb.from('projects').select('id, name, slug').order('name'),
    sb.from('vault_entries').select('project_id'), // metadata only: ciphertext is never selected for listings
  ]);
  const count = (id: string) => (entries ?? []).filter((e) => e.project_id === id).length;
  const keyOk = Boolean(process.env.VAULT_MASTER_KEY);

  return (
    <div className="max-w-[56rem]">
      <h1 className="text-h1 font-semibold">Credentials vault</h1>
      <p className="mt-3 max-w-[60ch] text-small text-ink-muted">
        Secrets are encrypted with AES-256-GCM before they reach the database. Revealing one requires your password and is logged. Secrets never enter documentation or AI prompts.
      </p>
      {!keyOk && <p className="mt-4 border border-warning p-4 text-small text-warning">VAULT_MASTER_KEY is not set. Run "npm run keygen" and add the result to .env before storing secrets.</p>}
      <Notice error={searchParams.error} ok={searchParams.ok} />

      <ul className="mt-6 divide-y divide-line border-y border-line">
        {(projects ?? []).map((p) => (
          <li key={p.id}>
            <Link href={`/admin/vault/${p.id}`} className="grid gap-1 py-4 hover:bg-bg-secondary sm:grid-cols-[1fr_auto] sm:gap-5">
              <span><span className="block text-body font-medium">{p.name}</span><span className="block font-mono text-small text-ink-muted">{p.slug}</span></span>
              <span className="font-mono text-label uppercase text-ink-muted">{count(p.id)} {count(p.id) === 1 ? 'secret' : 'secrets'}</span>
            </Link>
          </li>
        ))}
        {(projects ?? []).length === 0 && <li className="py-4 text-small text-ink-muted">Create a project first.</li>}
      </ul>

      <form action={backupVault} className="mt-8 border border-line p-5">
        <p className="font-mono text-label uppercase text-ink-muted">Encrypted backup</p>
        <p className="mt-2 max-w-[60ch] text-small text-ink-muted">Encrypts the whole vault again with BACKUP_ENCRYPTION_KEY and stores it in ZevCloud S3 (Supabase Storage if S3 is unavailable). Restore with "npm run decrypt-backup".</p>
        <button type="submit" className={`${BTN_GHOST} mt-4`}>Back up now</button>
      </form>
    </div>
  );
}
