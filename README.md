# HAMXELL CORE

A technology laboratory's web application: a public headquarters (`/`) and a private control centre (`/admin`, never linked from the public site).
Next.js 14 (App Router), TypeScript, Tailwind CSS mapped to design tokens, Supabase for data and auth.

**To set it up, run it and check it, follow [`docs/CHECKLIST.md`](docs/CHECKLIST.md). To deploy it, see [`docs/DEPLOY.md`](docs/DEPLOY.md).**

## Quick start
```
npm install
cp env.example .env.local        # fill in what you have; the public site runs with no keys
npm run dev                      # development
npm start                        # production build, then serve (use npm run serve after a build)
```
With no keys the public site runs on placeholder data and `/admin/login` says Supabase is not configured. To switch on the control centre: create a Supabase project (enable TOTP MFA), run `supabase/migrations/0001` to `0010` in order, set the Supabase and bootstrap variables, then `npm run bootstrap-admin`.

## Scripts
| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `serve` / `start` | Develop, build, serve a built site, build then serve |
| `npm run worker` | Background archiver and queued jobs (own process) |
| `npm run bootstrap-admin` | Create the first owner (flagged to change password at first sign-in) |
| `npm run keygen` | Generate a 32-byte key for the vault or backups |
| `npm run decrypt-backup -- file.json.enc` | Restore an encrypted vault backup |
| `npm run tidb:migrate` | Create the archive table in each TiDB cluster |
| `npm run test:overflow` | 320px-and-up overflow regression against a running site |
| `python3 scripts/build_logo_animation.py` | Regenerate the logo SVGs and the animated intro |

## What is in it
**Public site.** Home (intro, rotating "what we build", services, process, skills and stack, closing frame), `/products`, `/experiments`, `/labs`, `/docs` with exports, `/about`, `/contact`, `/licenses`, project pages by visibility (`/products/`, `/u/`, `/p/`), styled 404 and error pages, `robots.txt` and `sitemap.xml`, a scroll-aware assistant. Motion on every page: scroll reveals, route transitions, magnetic hover, a custom cursor for fine pointers, site-wide turning emblems that spin up on a long press. All of it is off for reduced-motion users; the cursor is off on touch.

**Control centre.** Projects (category, status, visibility, optional access password), importer, documentation studio with version history, vault, domains, deployments, analytics, assets, enquiries, Knowledge Engine, archive, settings (organisation, feature flags, administrators), activity log.

| Area | Key facts |
|---|---|
| **Visibility** | public: listed, indexed. unlisted: `/u/slug`, noindex. warning: `/p/slug`, notice first, optional password, details load only afterwards, noindex. private: admins only, 404 publicly. Status is separate from visibility. |
| **Sign-in** | Password + TOTP (aal2) on every admin page and action; 5 attempts per 15 minutes per address; HttpOnly SameSite=Strict cookies; accounts made with a temporary password must set their own first. Owners add and remove admins in Settings (never the last owner, never yourself). |
| **Importer** | Reads a public site (polite crawl of up to 6 pages: robots.txt honoured, private networks blocked at connect time, 10 s timeout, 5 MB cap; sitemap, headers, compression) and writes a description of it: a tagline and five or six paragraphs on what it is, what it offers, how it appears to be built and how well it is run. AI-written from page content and plain-language signals, with a cautious automatic fallback when no provider is reachable. No audit report is produced or stored; the fixed checks run quietly only to inform the write-up. Optional public GitHub repository (metadata and root file names only). |
| **AI** | Gemini, Groq, OpenRouter with per-task order and automatic fallback, token caps, and refusal to send anything that looks like a credential. Prompts are versioned in `lib/ai/prompts`. |
| **Docs** | Four documents per project, AI drafts or manual, Markdown with live preview, Draft/Published, public only when the project is public, exports, version history with restore. Raw HTML is never rendered. |
| **Vault** | AES-256-GCM per secret, entry id bound as authenticated data, owner role only, password re-entry to reveal, 30 s hide and clipboard clear, every reveal logged, encrypted backups. Never read by AI or the Knowledge Engine. |
| **Data** | Supabase (Postgres) is the source of truth. MongoDB holds analytics, chat logs, importer history and AI responses; Redis shares rate limits and locks and queues work. The worker copies data older than `ARCHIVE_AGE_DAYS` to TiDB as JSON, reads it back, compares a checksum, and only then deletes it. Documentation versions go to cluster D, activity logs to cluster E (the append-only log can only be purged through one service-role function, after verification), the rest to A, B and C. Each store falls back or switches off cleanly when not configured. |
| **Email** | Contact form: honeypot, minimum fill time, rate limit, validation. The enquiry is saved first, then Brevo sends an acknowledgement and a notification; failures are flagged with a retry button. Header and HTML injection are neutralised. |
| **Chatbot** | Keyword (BM25) retrieval over public products and published docs only; an unanswerable question returns a fixed message **without calling a model**; plain-text answers; anonymised logs. The Knowledge Engine does the same over everything an admin can see, never the vault. |
| **Analytics** | Cookieless, no IPs or visitor IDs, honours Do Not Track, never records `/admin`. Counts page views, not unique visitors. |

## Security model in short
No secret is in the client bundle or in AI prompts; the vault has its own table, key and role; every admin request re-checks session, MFA, admin membership and the password-change flag; public pages never return unlisted, warning-gated or private data; uploads are validated by content, not name; every untrusted string is escaped or placed in a code span; headers set on every response (nosniff, frame denial, referrer policy, permissions policy, HSTS). A Content-Security-Policy is not included; it needs testing on your host.

## Layout
```
app/(public)/      public pages, layout, route transition
app/admin/         login, account, and the guarded console
app/api/           analytics collector, chat, health, cron
components/        UI, motion, admin widgets
lib/               auth, ai, importer, rag, vault, db (mongo/tidb/redis/archiver), docs, markdown
content/           editable text: home sections, social links, about
supabase/migrations/   0001 to 0010
db/                TiDB schema, MongoDB collection notes
worker/            background process
scripts/           bootstrap, keys, restore, logo generator, overflow test
docs/              CHECKLIST.md, DEPLOY.md
```

## Known gaps
Importer screenshots and file upload; a Content-Security-Policy; semantic chatbot search; vault key rotation; in-app replies to enquiries; importer and doc generation run synchronously rather than on the queue; ZevCloud-specific configuration. Models change often: check `GEMINI_MODEL`, `GROQ_MODEL` and `OPENROUTER_MODEL` against each provider's list before deploying. Brevo requires a verified sender address.

## Placeholders to replace
`content/site.ts` (services, process, skills, social links) and `content/about.ts` (founder, CV) contain wording I drafted. Product entries shown with a "Placeholder" tag disappear as soon as real projects exist.
