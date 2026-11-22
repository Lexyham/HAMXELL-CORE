/**
 * Background worker (run as its own process: `npm run worker`).
 * - archives hot data into TiDB every ARCHIVE_CRON_INTERVAL_HOURS
 * - runs "archive now" jobs requested from the control centre through the Redis queue
 */
import { archiveNow } from '../lib/db/run';
import { makeConsumer } from '../lib/db/queue';

const log = (m: string) => console.log(`[worker ${new Date().toISOString()}] ${m}`);
const hours = Math.max(0.1, Number(process.env.ARCHIVE_CRON_INTERVAL_HOURS ?? 6));
let running = true;

async function pass(trigger: string) {
  try {
    const r = await archiveNow(trigger, { log });
    if (r.locked) return log(`${trigger}: another archiver holds the lock, skipping`);
    const moved = r.results.reduce((n, x) => n + x.moved, 0);
    const problems = r.results.filter((x) => x.error || x.skipped);
    log(`${trigger}: moved ${moved} documents; ${problems.length} collection(s) need attention${problems.map((p) => ` [${p.collection}: ${p.error ?? p.skipped}]`).join('')}`);
  } catch (e) {
    log(`${trigger}: failed: ${(e as Error).message}`); // never crash the loop; retried next run
  }
}

async function main() {
  log(`started; archive interval ${hours}h`);
  const timer = setInterval(() => void pass('cron'), hours * 3600 * 1000);
  setTimeout(() => void pass('startup'), 15_000);

  const consumer = makeConsumer();
  log(consumer.available ? 'listening for queued jobs' : 'REDIS_URL not set: running on the timer only');
  const stop = () => { running = false; clearInterval(timer); log('shutting down'); void consumer.close(); setTimeout(() => process.exit(0), 1500); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  while (running) {
    if (!consumer.available) { await new Promise((r) => setTimeout(r, 5000)); continue; }
    try {
      const job = await consumer.next(5);
      if (job?.type === 'archive') await pass(`queue:${job.requestedBy ?? 'unknown'}`);
    } catch (e) {
      log(`queue error: ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
void main();
