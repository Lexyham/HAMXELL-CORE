# MongoDB hot store: collections

Database: `MONGODB_DB` (default `hamxell_core`). Every document has a `createdAt` Date (indexed); anything older than
`ARCHIVE_AGE_DAYS` (30) is moved to TiDB by the archiver and then deleted here.

| Collection | Written by | Fields | Archived to |
|---|---|---|---|
| `analytics_events` | `/api/collect` | type (view/vitals), path, referrer_host, device, lcp_ms, cls, ttfb_ms | cluster A |
| `chatbot_logs` | chatbot (Phase 10) | anonymised conversation turns | cluster B |
| `importer_jobs` | project importer | url, status, error, ms, actorId | cluster C |
| `crawler_snapshots` | project importer | url, finalUrl, status, headers (allowlist), body (capped at 200 KB) | cluster C |
| `raw_ai_responses` | AI client | task, provider, model, promptVersion, status, ms, tokens, costUsd (null), attempts, response (capped) | cluster C |
| `archive_runs` | archiver | startedAt, finishedAt, trigger, results[] | not archived |

Indexes are created automatically on first connection: `createdAt` on every hot collection, `{type, createdAt}` on
`analytics_events`, `startedAt` on `archive_runs`.
