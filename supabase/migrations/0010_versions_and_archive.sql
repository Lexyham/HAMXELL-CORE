-- HAMXELL CORE, final phase: documentation version history + archiving of old versions and activity logs. Run after 0009.

create table public.documentation_versions (
  id bigint generated always as identity primary key,
  doc_id uuid references public.documentation_docs (id) on delete set null,
  project_id uuid not null references public.projects (id) on delete cascade,
  kind text not null,
  title text not null,
  content_md text not null,
  source text not null,
  status text not null,
  saved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index documentation_versions_lookup_idx on public.documentation_versions (project_id, kind, created_at desc);
alter table public.documentation_versions enable row level security;
create policy doc_versions_admin_all on public.documentation_versions for all using (public.is_admin()) with check (public.is_admin());

-- The activity log stays append-only for everyone. The single exception is the archiver: it copies old rows to TiDB (cluster E),
-- verifies them, and only then calls this function, which is the only way a row can be deleted. It is callable by the service role alone.
create or replace function public.activity_logs_immutable() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and current_setting('app.archiving', true) = 'on' then return old; end if;
  raise exception 'activity_logs is append-only';
end $$;

create or replace function public.purge_archived_activity_logs(ids bigint[]) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform set_config('app.archiving', 'on', true);
  delete from public.activity_logs where id = any (ids);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purge_archived_activity_logs(bigint[]) from public, anon, authenticated;
grant execute on function public.purge_archived_activity_logs(bigint[]) to service_role;
