import { parseEvent } from '@/lib/analytics';
import { flag } from '@/lib/flags';
import { rateLimit } from '@/lib/rate-limit';
import { getDb, mongoConfigured } from '@/lib/db/mongo';
import { serviceClient } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const done = () => new Response(null, { status: 204 });

/** Public, write-only analytics endpoint. Stores page, referrer host, device class and vitals. Never an IP, cookie or visitor id. */
export async function POST(req: Request) {
  if (!flag('FEATURE_ANALYTICS_DASHBOARD') || !(mongoConfigured() || supabaseConfigured())) return done();
  if (req.headers.get('dnt') === '1' || req.headers.get('sec-gpc') === '1') return done();

  const caller = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'; // used only as a transient rate-limit key
  if (!(await rateLimit(`collect:${caller}`, 120, 60_000))) return done();

  const text = await req.text();
  if (text.length > 2048) return new Response(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const row = parseEvent(body, new URL(req.url).hostname);
  if (!row) return new Response(null, { status: 400 });
  try {
    if (mongoConfigured()) await (await getDb()).collection('analytics_events').insertOne({ ...row, createdAt: new Date() }); // hot store
    else await serviceClient().from('analytics_events').insert(row); // fallback when MongoDB is not configured
  } catch (e) {
    console.error('analytics insert failed', (e as Error).message);
  }
  return done();
}
