-- HAMXELL CORE, Phase 2: admins, projects (visibility system), activity log.
-- Run in the Supabase SQL editor (or `supabase db push`). Enable TOTP MFA under Authentication > Providers/MFA.

create extension if not exists pgcrypto;

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'owner' check (role in ('owner', 'editor')),
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  name text not null check (char_length(name) between 1 and 120),
  summary text not null default '',
  description text not null default '',
  status text not null default 'in_development'
    check (status in ('in_development', 'active', 'experimental', 'paused', 'archived', 'discontinued')),
  visibility text not null default 'private'
    check (visibility in ('public', 'unlisted', 'warning', 'private')),
  tags text[] not null default '{}',
  launch_url text,
  warning_text text,
  licence_type text,
  licence_text text,
  licence_url text,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_visibility_idx on public.projects (visibility, featured desc, created_at desc);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_email text,
  action text not null,
  entity text,
  entity_id text,
  meta jsonb not null default '{}',
  ip text,
  created_at timestamptz not null default now()
);

create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- Activity log is append-only, for everyone including the service role.
create function public.activity_logs_immutable() returns trigger language plpgsql as $$
begin raise exception 'activity_logs is append-only'; end $$;
create trigger activity_logs_no_change before update or delete on public.activity_logs
  for each row execute function public.activity_logs_immutable();

create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

alter table public.admins enable row level security;
alter table public.projects enable row level security;
alter table public.activity_logs enable row level security;

create policy admins_read_self on public.admins for select using (user_id = auth.uid());
-- Anonymous visitors can only ever read public projects. Unlisted/warning are served by the server via service role.
create policy projects_public_read on public.projects for select using (visibility = 'public');
create policy projects_admin_all on public.projects for all using (public.is_admin()) with check (public.is_admin());
create policy logs_admin_read on public.activity_logs for select using (public.is_admin());
-- No insert policy on activity_logs: only the server (service role) writes to it.
