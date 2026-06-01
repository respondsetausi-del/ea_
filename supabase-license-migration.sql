-- Migration: per-user license keys + distributor onboarding flag
-- Run this in your Supabase SQL editor on an existing project.

-- 1. License fields on app_users (the invited end-users)
alter table public.app_users
  add column if not exists license_key text,
  add column if not exists license_sent_at timestamptz;

-- Unique license keys (allows multiple NULLs, blocks duplicate keys)
create unique index if not exists app_users_license_key_idx
  on public.app_users (license_key)
  where license_key is not null;

-- 2. Onboarding flag on distributors (drives the first-login guided wizard)
alter table public.distributors
  add column if not exists onboarded boolean not null default false;

-- Grandfather existing distributors past onboarding
update public.distributors
  set onboarded = true
  where created_at < now() and onboarded = false;
