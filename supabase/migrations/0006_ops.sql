-- HAMXELL CORE, Phase 7: domains, deployments, analytics events, asset library. Run after 0005.
create table public.domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique check (char_length(domain) between 3 and 253),
  project_id uuid references public.projects (id) on delete set null,
  registrar text,
  host text,
  expires_on date,
  auto_renew boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  version text not null check (char_length(version) between 1 and 60),
  environment text not null default 'production' check (environment in ('production', 'staging', 'preview')),
  platform text,
  url text,
  commit_ref text,
  status text not null default 'success' check (status in ('success', 'failed', 'rolled_back')),
  notes text not null default '',
  deployed_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index deployments_project_idx on public.deployments (project_id, deployed_at desc);

-- First-party, cookieless analytics. No IP address, cookie or visitor id is stored. Written by the server only.
create table public.analytics_events (
  id bigint generated always as identity primary key,
  type text not null check (type in ('view', 'vitals')),
  path text not null,
  referrer_host text,
  device text check (device in ('mobile', 'tablet', 'desktop')),
  lcp_ms integer,
  cls numeric,
  ttfb_ms integer,
  created_at timestamptz not null default now()
);
create index analytics_events_created_idx on public.analytics_events (created_at desc);

create table public.assets (
  id uuid primary key,
  project_id uuid references public.projects (id) on delete set null,
  name text not null,
  kind text not null default 'other' check (kind in ('logo', 'screenshot', 'document', 'export', 'other')),
  storage_key text not null,
  provider text not null check (provider in ('s3', 'supabase')),
  content_type text not null,
  size_bytes bigint not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create trigger domains_updated_at before update on public.domains for each row execute function public.set_updated_at();

alter table public.domains enable row level security;
alter table public.deployments enable row level security;
alter table public.analytics_events enable row level security;
alter table public.assets enable row level security;
create policy domains_admin_all on public.domains for all using (public.is_admin()) with check (public.is_admin());
create policy deployments_admin_all on public.deployments for all using (public.is_admin()) with check (public.is_admin());
create policy assets_admin_all on public.assets for all using (public.is_admin()) with check (public.is_admin());
create policy analytics_admin_read on public.analytics_events for select using (public.is_admin());
-- No insert policy on analytics_events: only the server (service role) writes it.
