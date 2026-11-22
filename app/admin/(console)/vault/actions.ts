'use server';

import { createClient as createVerifier } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { looksLikeSecret } from '@/lib/ai/context';
import { requireOwner } from '@/lib/auth';
import { flag } from '@/lib/flags';
import { isLimited, recordHit } from '@/lib/rate-limit';
import { putObject } from '@/lib/storage';
import { createClient } from '@/lib/supabase/server';
import { loadKey, seal, unseal, VaultConfigError } from '@/lib/vault/crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = ['password', 'api_key', 'token', 'certificate', 'other'];
const MAX_SECRET = 8192;
const t = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const lines = (v: string) => v.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 40);

function guard() {
  if (!flag('FEATURE_CREDENTIALS_VAULT')) redirect('/admin/vault');
}

export async function saveInfra(fd: FormData) {
  const { user, email } = await requireOwner();
  guard();
  const pid = t(fd, 'project_id');
  const back = `/admin/vault/${pid}`;
  const fail = (m: string): never => redirect(`${back}?error=${encodeURIComponent(m)}`);
  if (!UUID.test(pid)) redirect('/admin/vault');

  const envNames = t(fd, 'env_var_names').split(/[\s,]+/).filter(Boolean).slice(0, 80);
  if (envNames.some((n) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(n))) fail('Environment variable names may only contain letters, digits and underscores. Store names here, never values.');
  const refs = lines(t(fd, 'api_key_refs'));
  const notes = t(fd, 'config_notes');
  const recovery = t(fd, 'recovery_steps');
  if ([...refs, notes, recovery, t(fd, 'username')].some(looksLikeSecret)) fail('That text looks like a credential. Put secrets in the vault below, not in these fields.');

  const { error } = await createClient().from('project_infra').upsert({
    project_id: pid,
    admin_url: t(fd, 'admin_url') || null,
    username: t(fd, 'username') || null,
    hosting: t(fd, 'hosting') || null,
    db_provider: t(fd, 'db_provider') || null,
    deploy_platform: t(fd, 'deploy_platform') || null,
    env_var_names: envNames,
    api_key_refs: refs,
    config_notes: notes.slice(0, 8000),
    recovery_steps: recovery.slice(0, 8000),
  });
  if (error) fail('Could not save.');
  await logActivity({ actorId: user.id, actorEmail: email, action: 'vault.infra_save', entity: 'project', entityId: pid });
  redirect(`${back}?ok=${encodeURIComponent('Saved.')}`);
}

export async function addSecret(fd: FormData) {
  const { user, email } = await requireOwner();
  guard();
  const pid = t(fd, 'project_id');
  const back = `/admin/vault/${pid}`;
  const fail = (m: string): never => redirect(`${back}?error=${encodeURIComponent(m)}`);
  if (!UUID.test(pid)) redirect('/admin/vault');

  const label = t(fd, 'label');
  const kind = t(fd, 'kind');
  const value = String(fd.get('value') ?? '');
  if (!label || label.length > 100) fail('Enter a label (up to 100 characters).');
  if (!KINDS.includes(kind)) fail('Invalid type.');
  if (!value || value.length > MAX_SECRET) fail(`The secret must be between 1 and ${MAX_SECRET} characters.`);

  let sealed;
  const id = randomUUID();
  try {
    sealed = seal(loadKey('VAULT_MASTER_KEY'), value, id);
  } catch (e) {
    fail(e instanceof VaultConfigError ? e.message : 'Encryption failed.');
  }
  const { error } = await createClient().from('vault_entries').insert({ id, project_id: pid, label, kind, ciphertext: sealed!.ct, iv: sealed!.iv, tag: sealed!.tag, created_by: user.id });
  if (error) fail('Could not save the secret.');
  await logActivity({ actorId: user.id, actorEmail: email, action: 'vault.create', entity: 'vault_entry', entityId: id, meta: { label, kind } });
  redirect(`${back}?ok=${encodeURIComponent('Secret stored (encrypted).')}`);
}

export async function rotateSecret(fd: FormData) {
  const { user, email } = await requireOwner();
  guard();
  const id = t(fd, 'id');
  const pid = t(fd, 'project_id');
  const back = `/admin/vault/${pid}`;
  const fail = (m: string): never => redirect(`${back}?error=${encodeURIComponent(m)}`);
  const value = String(fd.get('value') ?? '');
  if (!UUID.test(id) || !UUID.test(pid)) redirect('/admin/vault');
  if (!value || value.length > MAX_SECRET) fail(`The new value must be between 1 and ${MAX_SECRET} characters.`);

  let sealed;
  try {
    sealed = seal(loadKey('VAULT_MASTER_KEY'), value, id);
  } catch (e) {
    fail(e instanceof VaultConfigError ? e.message : 'Encryption failed.');
  }
  const { error } = await createClient().from('vault_entries').update({ ciphertext: sealed!.ct, iv: sealed!.iv, tag: sealed!.tag }).eq('id', id);
  if (error) fail('Could not update the secret.');
  await logActivity({ actorId: user.id, actorEmail: email, action: 'vault.rotate', entity: 'vault_entry', entityId: id });
  redirect(`${back}?ok=${encodeURIComponent('Secret updated.')}`);
}

export async function deleteSecret(fd: FormData) {
  const { user, email } = await requireOwner();
  guard();
  const id = t(fd, 'id');
  const pid = t(fd, 'project_id');
  if (!UUID.test(id) || !UUID.test(pid)) redirect('/admin/vault');
  const { error } = await createClient().from('vault_entries').delete().eq('id', id);
  if (!error) await logActivity({ actorId: user.id, actorEmail: email, action: 'vault.delete', entity: 'vault_entry', entityId: id });
  redirect(`/admin/vault/${pid}`);
}

const ATTEMPTS = 5;
const WINDOW = 15 * 60 * 1000;

/**
 * Reveal requires the owner to re-enter their password (checked against Supabase Auth with a throw-away client, so the
 * current session is untouched). Failed attempts are rate limited. Every outcome is written to the activity log; the secret never is.
 */
export async function revealSecret(entryId: string, password: string): Promise<{ secret: string } | { error: string }> {
  const { user, email } = await requireOwner();
  if (!flag('FEATURE_CREDENTIALS_VAULT')) return { error: 'The vault is switched off.' };
  if (!UUID.test(entryId)) return { error: 'Not found.' };
  const key = `reveal:${user.id}`;
  if (await isLimited(key, ATTEMPTS, WINDOW)) return { error: 'Too many failed attempts. Try again in 15 minutes.' };
  if (!password) return { error: 'Enter your password.' };

  const verifier = createVerifier(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: authError } = await verifier.auth.signInWithPassword({ email, password });
  if (authError) {
    await recordHit(key, WINDOW);
    await logActivity({ actorId: user.id, actorEmail: email, action: 'vault.reveal_denied', entity: 'vault_entry', entityId: entryId });
    return { error: 'Incorrect password.' };
  }
  await verifier.auth.signOut();

  const sb = createClient();
  const { data: row } = await sb.from('vault_entries').select('id, label, ciphertext, iv, tag').eq('id', entryId).maybeSingle();
  if (!row) return { error: 'Not found.' };
  let secret: string;
  try {
    secret = unseal(loadKey('VAULT_MASTER_KEY'), { ct: row.ciphertext, iv: row.iv, tag: row.tag }, row.id);
  } catch (e) {
    await logActivity({ actorId: user.id, actorEmail: email, action: 'vault.decrypt_failed', entity: 'vault_entry', entityId: entryId });
    return { error: e instanceof VaultConfigError ? e.message : 'Could not decrypt this entry (wrong key or altered data).' };
  }
  await sb.from('vault_entries').update({ last_revealed_at: new Date().toISOString() }).eq('id', entryId);
  await logActivity({ actorId: user.id, actorEmail: email, action: 'vault.reveal', entity: 'vault_entry', entityId: entryId, meta: { label: row.label } });
  return { secret };
}

/** Encrypted backup: the vault dump is encrypted again with BACKUP_ENCRYPTION_KEY and stored in ZevCloud S3 (or the Supabase fallback). */
export async function backupVault() {
  const { user, email } = await requireOwner();
  guard();
  const fail = (m: string): never => redirect(`/admin/vault?error=${encodeURIComponent(m)}`);
  const sb = createClient();
  const [{ data: entries }, { data: infra }] = await Promise.all([sb.from('vault_entries').select('*'), sb.from('project_infra').select('*')]);

  let envelope;
  try {
    const aad = 'hamxell-vault-backup-v1';
    envelope = { v: 1, alg: 'aes-256-gcm', aad, ...seal(loadKey('BACKUP_ENCRYPTION_KEY'), JSON.stringify({ at: new Date().toISOString(), entries, infra }), aad) };
  } catch (e) {
    fail(e instanceof VaultConfigError ? e.message : 'Backup encryption failed.');
  }
  const key = `backups/vault-${new Date().toISOString().replace(/[:.]/g, '-')}.json.enc`;
  try {
    const provider = await putObject(key, new TextEncoder().encode(JSON.stringify(envelope)), 'application/octet-stream');
    await logActivity({ actorId: user.id, actorEmail: email, action: 'vault.backup', entity: 'backup', meta: { key, provider, entries: entries?.length ?? 0 } });
    redirect(`/admin/vault?ok=${encodeURIComponent(`Backup stored: ${key} (${provider}).`)}`);
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw e;
    fail((e as Error).message);
  }
}
