import 'server-only';
import { headers } from 'next/headers';
import { serviceClient } from './supabase/admin';

export const clientIp = () => headers().get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

export async function logActivity(e: {
  actorId?: string;
  actorEmail?: string;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await serviceClient().from('activity_logs').insert({
      actor_id: e.actorId ?? null,
      actor_email: e.actorEmail ?? null,
      action: e.action,
      entity: e.entity ?? null,
      entity_id: e.entityId ?? null,
      meta: e.meta ?? {},
      ip: clientIp(),
    });
  } catch (err) {
    console.error('activity log failed', err);
  }
}
