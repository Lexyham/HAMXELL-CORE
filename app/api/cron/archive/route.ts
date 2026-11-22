import { createHash, timingSafeEqual } from 'node:crypto';
import { archiveNow } from '@/lib/db/run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const digest = (s: string) => createHash('sha256').update(s).digest();

/**
 * Lets a platform scheduler (or any cron service) run the archive over HTTP on hosts that cannot keep a worker process alive.
 * Disabled (404) unless CRON_SECRET is set. Authenticate with:  Authorization: Bearer <CRON_SECRET>
 * Each call processes a bounded amount of data, so schedule it often (for example every 15 minutes) rather than rarely.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response('Not found', { status: 404 });
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!timingSafeEqual(digest(given), digest(secret))) return new Response('Unauthorized', { status: 401 });

  const r = await archiveNow('cron:http', { maxBatches: 3 });
  const body = { locked: Boolean(r.locked), moved: r.results.reduce((n, x) => n + x.moved, 0), problems: r.results.filter((x) => x.error || x.skipped).map((x) => ({ collection: x.collection, note: x.error ?? x.skipped })) };
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
}
export { handle as GET, handle as POST };
