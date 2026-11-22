import { NextResponse } from 'next/server';
import { logActivity } from '@/lib/activity';
import { requireAdmin } from '@/lib/auth';
import { downloadUrl, type StorageProvider } from '@/lib/storage';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { user, email } = await requireAdmin();
  if (!UUID.test(params.id)) return new Response('Not found', { status: 404 });
  const { data } = await createClient().from('assets').select('name, storage_key, provider').eq('id', params.id).maybeSingle();
  if (!data) return new Response('Not found', { status: 404 });
  try {
    const url = await downloadUrl(data.provider as StorageProvider, data.storage_key, data.name);
    await logActivity({ actorId: user.id, actorEmail: email, action: 'asset.download', entity: 'asset', entityId: params.id });
    const res = NextResponse.redirect(url);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (e) {
    return new Response((e as Error).message, { status: 502 });
  }
}
