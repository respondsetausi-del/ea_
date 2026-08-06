-- ============================================================
-- 30-day access window for app_users.
--
-- Until now access never ended: /api/v1/authorize granted entry on
-- `status = 'approved' AND is_active`, with no date compared against anything.
-- `paid_at` looks like an expiry anchor but is only ever read as a boolean —
-- and nothing in the codebase writes it (there is no Stripe webhook yet), so
-- it cannot be the clock.
--
-- The clock is `access_expires_at`, an explicit timestamp set when access
-- BEGINS rather than derived from payment:
--
--   admin approves           ->  access_expires_at = now() + 30 days
--   admin extends (renewal)  ->  pushed further out
--   (future) payment webhook ->  extend from paid_at instead
--
-- Storing the deadline instead of computing it makes a renewal one UPDATE, and
-- lets an admin grant a bespoke window without special-casing anything.
--
-- NULL means "never expires".
--
-- Safe to re-run. Paste the whole file into the Supabase SQL editor.
-- ============================================================


-- ── 1. Settings table ──
-- Created here too so this file stands alone regardless of migration order.
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.app_settings enable row level security;
-- No public policies: only the service role touches it.


-- ── 2. The deadline ──
alter table public.app_users
  add column if not exists access_expires_at timestamptz;

comment on column public.app_users.access_expires_at is
  'When this user loses access. NULL = never expires.';

-- Checked on every authorize call.
create index if not exists app_users_access_expires_idx
  on public.app_users (access_expires_at)
  where access_expires_at is not null;


-- ── 3. Window length ──
-- Read by the approve + extendAccess admin actions. Change the number here to
-- change the window for FUTURE approvals; no deploy needed.
insert into public.app_settings (key, value)
values ('access_days', '30'::jsonb)
on conflict (key) do nothing;


-- ── 4. Backfill ──
-- Nobody has paid yet, so there is no paying customer to cut off. This gives
-- every currently-approved user a clean 30 days starting now, so the whole
-- base is consistent rather than a mix of dated and never-expiring rows.
--
-- Deliberately NOT dated from approved_at: that would retroactively expire
-- anyone approved more than 30 days ago the moment you run this.
update public.app_users
   set access_expires_at = now() + interval '30 days'
 where status = 'approved'
   and access_expires_at is null;


-- ── 5. Check what you just did ──
select
  email,
  status,
  is_active,
  access_expires_at,
  case
    when access_expires_at is null then 'never expires'
    when access_expires_at < now() then 'EXPIRED'
    else ceil(extract(epoch from (access_expires_at - now())) / 86400)::text || ' days left'
  end as access
from public.app_users
order by access_expires_at nulls first, email;


-- ============================================================
-- Handy afterwards
-- ============================================================
--
-- Give one user another 30 days:
--   update public.app_users
--      set access_expires_at = greatest(now(), coalesce(access_expires_at, now())) + interval '30 days'
--    where lower(email) = lower('client@example.com');
--
-- Undo the backfill (put everyone back to never-expiring):
--   update public.app_users set access_expires_at = null;
--
-- Expire someone immediately:
--   update public.app_users
--      set access_expires_at = now()
--    where lower(email) = lower('client@example.com');
