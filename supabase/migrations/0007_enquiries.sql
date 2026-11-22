-- HAMXELL CORE, Phase 9: contact enquiries. Run after 0006.
create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 254),
  subject text not null default '' check (char_length(subject) <= 150),
  message text not null check (char_length(message) between 10 and 5000),
  status text not null default 'new' check (status in ('new', 'read', 'replied', 'closed')),
  ack_sent_at timestamptz,      -- acknowledgement to the visitor accepted by Brevo
  notified_at timestamptz,      -- notification to the admin accepted by Brevo
  email_error text,             -- last email failure, if any (the enquiry is saved regardless)
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index enquiries_status_idx on public.enquiries (status, created_at desc);
create trigger enquiries_updated_at before update on public.enquiries for each row execute function public.set_updated_at();

alter table public.enquiries enable row level security;
create policy enquiries_admin_all on public.enquiries for all using (public.is_admin()) with check (public.is_admin());
-- No public policies: visitors never read or write this table directly. The server inserts with the service role after validation.
