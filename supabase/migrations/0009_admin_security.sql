-- HAMXELL CORE, final phase: per-project gate passwords and admin management. Run after 0008.

-- Gate passwords live in their own table so a hash can never be returned by a public query of `projects`.
create table public.project_gates (
  project_id uuid primary key references public.projects (id) on delete cascade,
  password_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.project_gates enable row level security;
create policy gates_admin_all on public.project_gates for all using (public.is_admin()) with check (public.is_admin());
-- No public policy: visitors' passwords are checked by the server with the service role.

-- Owners can list every admin (the existing policy only lets each admin see themselves).
create policy admins_owner_read on public.admins for select using (public.is_owner());
