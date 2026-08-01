-- Migration: runtime-managed super-admin allowlist
-- Lets a super admin add/remove admins by email at any time (even before the
-- person has registered). Run in your Supabase SQL editor.

create table if not exists public.admin_emails (
  email text primary key,
  created_at timestamptz default now()
);

alter table public.admin_emails enable row level security;
-- No public policies: only the service role (which bypasses RLS) reads/writes it.

-- Seed the bootstrap super admin.
insert into public.admin_emails (email) values ('respondsetausi@gmail.com')
  on conflict do nothing;

-- Flag any already-registered distributors whose email is on the list.
update public.distributors d
  set is_super_admin = true
  where exists (select 1 from public.admin_emails a where lower(a.email) = lower(d.email));

-- New signups auto-become admins when their email is on the allowlist.
create or replace function public.handle_new_distributor()
returns trigger as $$
begin
  insert into public.distributors (id, email, name, is_super_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    exists (select 1 from public.admin_emails a where lower(a.email) = lower(new.email))
  );

  insert into public.branding (distributor_id, app_name)
  values (new.id, 'EA NAPTUNE');

  return new;
end;
$$ language plpgsql security definer;
