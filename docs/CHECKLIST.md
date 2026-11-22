# HAMXELL CORE: what to run and what to verify

Everything here was tested **offline** with fakes and a headless browser. Nothing has been run against your real Supabase, MongoDB, Redis, TiDB, S3, Brevo or AI providers. This list is how you close that gap. Work top to bottom; each item says what you should see.

## 0. Accounts and keys you need

| Service | What to create | Variables | Needed for |
|---|---|---|---|
| Supabase | Project; enable TOTP MFA (Authentication); a private Storage bucket named `hamxell-assets` (fallback storage) | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | Everything in the control centre |
| Secrets | Run `npm run keygen` twice | `SESSION_SECRET` (any long random), `VAULT_MASTER_KEY`, `BACKUP_ENCRYPTION_KEY` (**back both keys up**) | Vault, backups |
| Admin | An email and a 12+ character password | `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | First sign-in |
| AI | At least one key. Check the model names are current | `GEMINI_API_KEY` / `GROQ_API_KEY` / `OPENROUTER_API_KEY`, `GEMINI_MODEL`, `GROQ_MODEL`, `OPENROUTER_MODEL` | AI docs, audit summaries, chatbot, Knowledge Engine |
| Brevo | Account, **verified sender address** | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_ADMIN_NOTIFY_EMAIL` | Contact form emails |
| MongoDB | Atlas cluster | `MONGODB_URI` | Analytics, logs, importer history (optional; falls back to Supabase) |
| Redis | Upstash or similar | `REDIS_URL` | Shared rate limits, locks, queue (optional) |
| TiDB Cloud | 5 clusters | `TIDB_CLUSTER_A..E_HOST/USER/PASS/DB`, `TIDB_PORT` | Cold archive (optional) |
| S3 | ZevCloud (or compatible) bucket | `ZEVCLOUD_S3_*` | Assets, backups (falls back to Supabase Storage) |
| GitHub | Optional token | `GITHUB_TOKEN` | Higher limit for repository reviews |

## 1. Run order

```
npm install
cp env.example .env                  # fill it in (section 0)
# Supabase SQL editor, in this exact order:
#   supabase/migrations/0001 ... 0010
npm run bootstrap-admin              # creates the first owner
npm run tidb:migrate                 # only if you use TiDB
python3 scripts/build_logo_animation.py   # only if you change the logo artwork
npm run build && npm run serve       # or: npm start   (builds, then serves)
npm run worker                       # second terminal: background archiver
npx playwright install chromium      # once, for the overflow test
npm run test:overflow                # with the site running
```

## 2. Phase by phase

### Phase 1: design system, layout, home
- [ ] Open `/`. The intro plays once, with no skip and no sound, then fades into the page.
- [ ] Reload: the intro plays again. Navigate to `/products` and back: it does not.
- [ ] Resize to 320px wide: no sideways scroll anywhere. The footer has no admin link.
- [ ] `npm run test:overflow` prints "No horizontal overflow at any tested width".

### Phase 2: sign-in, admin shell, projects, visibility
- [ ] `/admin/login` with the bootstrap account. You are shown a QR code; scan it and enter the 6-digit code.
- [ ] You are then forced to choose a new password (12+ characters). Afterwards the console opens.
- [ ] Create four projects with visibility public, unlisted, warning, private. Check: public appears at `/products`; unlisted works only at `/u/slug` and is not listed; warning shows a notice first at `/p/slug`; private returns 404 everywhere.
- [ ] `curl -I https://your-site/u/slug` and `/p/slug` show `X-Robots-Tag: noindex, nofollow`; so does `/admin/login`.
- [ ] Six wrong passwords in 15 minutes lock sign-in; the attempts appear in Activity.
- [ ] Add a gate password to the warning project: visitors must tick the box **and** enter it; a wrong one is refused.

### Phase 3: importer (website audit)
- [ ] Admin > Importer. Audit a site you control. Wait up to a minute.
- [ ] The report opens in the page: executive summary, scope, site profile, findings by area, page inventory, register, recommendations, conclusion, appendices.
- [ ] Download it as PDF, HTML and Markdown. Read the PDF: tables should not have broken words.
- [ ] Try `http://localhost` and `http://169.254.169.254`: both refused.
- [ ] Add a public GitHub repository: a Repository section appears. A wrong name gives a note, not a failed audit.
- [ ] "Create private draft project" makes a private, in-development project.

### Phase 4: AI documentation
- [ ] Project > Documentation > Generate. Four AI drafts appear, labelled "AI draft".
- [ ] Remove the first provider's key and generate again: it falls back to the next provider.
- [ ] On an importer result, "Add AI-written summary" adds a labelled summary and closing note.
- [ ] Calls are recorded (MongoDB `raw_ai_responses`, or Supabase `ai_call_logs`).

### Phase 5: documentation studio, reader, exports, history
- [ ] Edit a document, set Published. It appears at `/docs/<slug>` **only if the project is Public**.
- [ ] Export it as MD, HTML and PDF from the public page.
- [ ] Edit again, then open Version history: the earlier state is listed. "Restore as draft" brings it back.
- [ ] Regenerating with AI never overwrites a published or manually edited document.

### Phase 6: credentials vault (owner role)
- [ ] Add a secret. "Reveal" asks for your password; a wrong one is refused and logged.
- [ ] The revealed value hides after 30 seconds. Copy it, wait 30 seconds: the clipboard is cleared.
- [ ] Activity shows `vault.reveal` (never the value).
- [ ] "Back up now" stores an encrypted file. `npm run decrypt-backup -- file.json.enc > out.json` restores it.
- [ ] Sign in as an **editor**: the Vault is not in the menu and its address redirects away.

### Phase 7: domains, deployments, analytics, assets
- [ ] Add a domain with an expiry date under 14 days: it shows a red badge.
- [ ] Record a deployment; filter by project.
- [ ] Visit a few public pages, then open Analytics: page views and vitals appear. With Do Not Track on, nothing is recorded.
- [ ] Upload a PNG: it works. Upload an SVG, an HTML file, or an `.exe`: refused. Download via the 60-second link.

### Phase 8: hot store, cold archive, Redis
- [ ] Admin > Archive > "Test connections": each configured service says ok.
- [ ] **End-to-end archive test:** temporarily set `ARCHIVE_AGE_DAYS=0`, add some analytics events and activity, click "Run archive now" (with the worker running). The rows appear in TiDB (`SELECT COUNT(*) FROM archived_documents`) and are gone from MongoDB. Set the value back to 30.
- [ ] Documentation versions go to cluster D and activity logs to cluster E. In Supabase, `delete from activity_logs` by hand must fail ("append-only").
- [ ] With Redis set, rate limits are shared across instances.
- [ ] If your host cannot run the worker: set `CRON_SECRET`, then `curl -H "Authorization: Bearer $CRON_SECRET" https://your-site/api/cron/archive`.

### Phase 9: contact, email, enquiries
- [ ] Submit `/contact`. You get a confirmation email, and the admin address gets a notification.
- [ ] The enquiry is in Admin > Enquiries. Opening it marks it read. Walk it through replied and closed.
- [ ] Temporarily break `BREVO_API_KEY` and submit again: the enquiry is still saved, flagged, with a "Retry sending" button that works once the key is fixed.
- [ ] Six submissions within an hour from one connection are limited.

### Phase 10: chatbot and Knowledge Engine
- [ ] Publish a document for a public project. Wait 5 minutes (or restart) for the chatbot to know it.
- [ ] Ask about the project: a grounded answer with source links. Ask something unrelated: "I do not have that information" (no model call).
- [ ] The launcher appears when you scroll down, hides when you scroll up, and shows after a 3-second pause.
- [ ] `chatbot_logs` in MongoDB has no emails, phone numbers or IPs.
- [ ] Set `FEATURE_KNOWLEDGE_ENGINE=true`: Admin > Knowledge answers across projects, docs, infrastructure notes, deployments and domains. Ask for a password: it says credentials are in the vault.

### Phase 11: polish
- [ ] `/about`, `/licenses`, `/labs`, `/experiments` load. Set a project's category to see it move between Products, Experiments and Labs.
- [ ] `/robots.txt` and `/sitemap.xml` do not mention `/admin`, `/u/` or `/p/`.
- [ ] A made-up address shows the styled 404.
- [ ] Edit `content/about.ts` and `content/site.ts` to fill in the founder, CV, social links and service wording. Those are placeholders I wrote.

### Motion (added after your feedback)
- [ ] Every public page animates in: headings, lists, cards, forms. Page changes show a thin blue sweep along the top.
- [ ] The cursor ring follows the mouse, grows over links, shrinks on press and turns gold on a long press. It does not appear on a phone or with reduced motion.
- [ ] Emblems turn behind every page; press and hold anywhere (not on a form field) and they spin up.

### Phase 12: deployment
- [ ] `GET /api/health` returns `{"status":"ok"}`.
- [ ] Served over HTTPS; `curl -I` shows the security headers (nosniff, frame denial, referrer policy, HSTS).
- [ ] Worker running (or cron endpoint scheduled).
- [ ] Settings page: feature flags match what you intend. Add a second admin: they get a temporary password shown once, and must enrol MFA and change it at first sign-in.
- [ ] Supabase Authentication > SMTP points at Brevo so password-reset emails come from your domain.
- [ ] S3 lifecycle rules set in your S3 console (exports 90 days, backups 365 days). The app cannot set them.
- [ ] `VAULT_MASTER_KEY` and `BACKUP_ENCRYPTION_KEY` are stored somewhere safe **outside** the server.

## 3. Things I could not verify, and why
Real Supabase (RLS policies, MFA, auth admin calls, the activity-log purge function), MongoDB, Redis, TiDB, S3, Brevo delivery, AI provider responses, the Next.js production build in your environment, GSAP and Lenis running for real (tested with a stand-in that records calls), and any ZevCloud-specific settings. The migrations were written carefully and cross-checked against the code, but never executed.

## 4. Not built
Importer screenshots and file upload (a safe browser worker needs a deployment I cannot test here); a Content-Security-Policy; semantic (embedding) search for the chatbot; vault key rotation; replying to enquiries from inside the app; moving importer and documentation generation onto the queue (they run synchronously on purpose, so you see the result at once); a ZevCloud-specific configuration file.
