# Deploying HAMXELL CORE

I could not find ZevCloud's deployment format documented, so nothing here is ZevCloud-specific. These are the standard Node.js settings; map them onto whatever your host calls them.

## What runs
| Process | Command | Notes |
|---|---|---|
| Build | `npm ci && npm run build` | Node 20 recommended (Next 14 needs 18.17 or newer) |
| Web | `npm run serve` | Listens on `$PORT` (default 3000). Do **not** use `npm start` in production: it rebuilds on every start |
| Worker | `npm run worker` | Always-on. Runs the archiver and queued jobs. Optional |
| Cron (instead of a worker) | `GET /api/cron/archive` with `Authorization: Bearer $CRON_SECRET` | For hosts that cannot keep a second process running. Schedule it every 15 minutes |

A `Procfile`, `Dockerfile` and `docker-compose.yml` are included (the Docker files are untested here).

## Environment
Copy `.env.example`, fill it in, and set it in your host's environment. Never commit real values. Feature flags are environment variables; changing one needs a redeploy because some pages decide at build time.

## Database setup, once
1. Supabase SQL editor: run `supabase/migrations/0001` to `0010` in order.
2. Create the private Storage bucket named in `SUPABASE_STORAGE_BUCKET`.
3. `npm run bootstrap-admin` (from a machine with the service-role key).
4. If using TiDB: `npm run tidb:migrate`.

## Before you announce it
Work through `docs/CHECKLIST.md`, section 2, Phase 12 and the security items in Phases 2 and 6.

## Things that need an always-on process or a scheduler
Archiving old data (worker or cron) and queued archive requests (worker). Without either, the hot stores simply grow; nothing breaks.
