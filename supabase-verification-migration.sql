-- Migration: email verification / approval for distributors
-- Run this in your Supabase SQL editor on an existing project.

-- 1. Add verification columns to distributors
alter table public.distributors
  add column if not exists verified boolean not null default false,
  add column if not exists verification_token uuid default gen_random_uuid(),
  add column if not exists verified_at timestamptz;

-- 2. Grandfather in any existing distributors so they aren't locked out
update public.distributors
  set verified = true, verified_at = coalesce(verified_at, now()), verification_token = null
  where created_at < now() and verified = false;

-- 3. Index for fast token lookups during verification
create index if not exists distributors_verification_token_idx
  on public.distributors (verification_token);

-- NOTE: New signups are created by the handle_new_distributor() trigger.
-- The column defaults (verified=false, verification_token=gen_random_uuid())
-- apply automatically, so no trigger change is required.
