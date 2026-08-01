-- ============================================================
-- EA NAPTUNE — one-shot setup / migration (idempotent)
-- Paste the whole file into Supabase → SQL Editor → Run.
-- Safe to run multiple times.
-- ============================================================

-- 1) Distributors: verification, onboarding, admin + active flags
alter table public.distributors
  add column if not exists verified boolean not null default false,
  add column if not exists verification_token uuid default gen_random_uuid(),
  add column if not exists verified_at timestamptz,
  add column if not exists onboarded boolean not null default false,
  add column if not exists is_super_admin boolean not null default false,
  add column if not exists is_active boolean not null default true;

-- 2) App users: per-user license key
alter table public.app_users
  add column if not exists license_key text,
  add column if not exists license_sent_at timestamptz;

create unique index if not exists app_users_license_key_idx
  on public.app_users (license_key)
  where license_key is not null;

-- 3) Runtime admin allowlist (add admins by email at will)
create table if not exists public.admin_emails (
  email text primary key,
  created_at timestamptz default now()
);
alter table public.admin_emails enable row level security;

insert into public.admin_emails (email) values ('respondsetausi@gmail.com')
  on conflict do nothing;

-- 4) Auto-admin new signups whose email is on the allowlist
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

-- 5) Grandfather every existing distributor so they can log in right now
update public.distributors set verified = true where verified = false;

-- 6) Flag the super admin
update public.distributors
  set is_super_admin = true, is_active = true
  where lower(email) = 'respondsetausi@gmail.com';
