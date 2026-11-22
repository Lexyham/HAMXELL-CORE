'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { MAX_ASSET_BYTES, validateUpload } from '@/lib/assets';
import { requireAdmin } from '@/lib/auth';
import { putObject, removeObject, storageConfigured, type StorageProvider } from '@/lib/storage';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = ['logo', 'screenshot', 'document', 'export', 'other'];

export async function uploadAsset(fd: FormData) {
  const { user, email } = await requireAdmin();
  const fail = (m: string): never => redirect(`/admin/assets?error=${encodeURIComponent(m)}`);
  if (!storageConfigured()) fail('No storage backend is configured (ZevCloud S3 or Supabase Storage).');

  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0) fail('Choose a file.');
  if ((file as File).size > MAX_ASSET_BYTES) fail('The file is larger than 10 MB.');
  const kind = String(fd.get('kind') ?? 'other');
  const project = String(fd.get('project_id') ?? '');
  if (!KINDS.includes(kind)) fail('Invalid type.');
  if (project && !UUID.test(project)) fail('Invalid project.');

  const bytes = new Uint8Array(await (file as File).arrayBuffer());
  const v = validateUpload((file as File).name, bytes);
  if (!v.ok) fail(v.error);
  const ok = v as Extract<typeof v, { ok: true }>;

  const id = randomUUID();
  const key = `assets/${id}/${ok.name}`;
  let provider: StorageProvider;
  try {
    provider = await putObject(key, bytes, ok.contentType);
  } catch (e) {
    return fail((e as Error).message);
  }
  const { error } = await createClient().from('assets').insert({ id, project_id: project || null, name: ok.name, kind, storage_key: key, provider, content_type: ok.contentType, size_bytes: bytes.length, created_by: user.id });
  if (error) {
    await removeObject(provider, key).catch(() => {});
    fail('The file was stored but could not be recorded, so it was removed. Try again.');
  }
  await logActivity({ actorId: user.id, actorEmail: email, action: 'asset.upload', entity: 'asset', entityId: id, meta: { name: ok.name, kind, provider, bytes: bytes.length } });
  redirect('/admin/assets');
}

export async function deleteAsset(fd: FormData) {
  const { user, email } = await requireAdmin();
  const id = String(fd.get('id') ?? '');
  if (!UUID.test(id)) redirect('/admin/assets');
  const sb = createClient();
  const { data } = await sb.from('assets').select('storage_key, provider, name').eq('id', id).maybeSingle();
  if (data) {
    try { await removeObject(data.provider as StorageProvider, data.storage_key); } catch (e) { console.error('object removal failed', (e as Error).message); }
    const { error } = await sb.from('assets').delete().eq('id', id);
    if (!error) await logActivity({ actorId: user.id, actorEmail: email, action: 'asset.delete', entity: 'asset', entityId: id, meta: { name: data.name } });
  }
  redirect('/admin/assets');
}
