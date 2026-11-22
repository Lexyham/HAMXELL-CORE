-- HAMXELL CORE, Phase 3: project importer results. Run after 0001_phase2.sql.
create table public.project_imports (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  result jsonb not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index project_imports_created_idx on public.project_imports (created_at desc);

alter table public.project_imports enable row level security;
create policy imports_admin_all on public.project_imports for all
  using (public.is_admin()) with check (public.is_admin());
