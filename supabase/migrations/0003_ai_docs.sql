-- HAMXELL CORE, Phase 4: generated documentation drafts + AI call log. Run after 0002.
create table public.documentation_docs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  kind text not null check (kind in ('readme', 'user-guide', 'features', 'technical')),
  title text not null,
  content_md text not null,
  source text not null default 'ai' check (source in ('ai', 'manual')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  provider text,
  model text,
  prompt_version text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, kind)
);
create trigger documentation_docs_updated_at before update on public.documentation_docs
  for each row execute function public.set_updated_at();

create table public.ai_call_logs (
  id bigint generated always as identity primary key,
  task text not null,
  provider text,
  model text,
  prompt_version text,
  status text not null check (status in ('ok', 'error')),
  ms integer,
  input_tokens integer,
  output_tokens integer,
  response_chars integer,
  attempts jsonb not null default '[]',
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index ai_call_logs_created_idx on public.ai_call_logs (created_at desc);

alter table public.documentation_docs enable row level security;
alter table public.ai_call_logs enable row level security;
create policy docs_admin_all on public.documentation_docs for all using (public.is_admin()) with check (public.is_admin());
-- Drafts are admin-only. Public reading of published docs arrives with the /docs reader in Phase 5.
create policy ai_logs_admin_read on public.ai_call_logs for select using (public.is_admin());
-- No insert policy on ai_call_logs: only the server (service role) writes it.
