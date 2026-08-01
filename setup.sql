-- ============================================================
-- EA NAPTUNE - full database setup
-- Run ONCE on a fresh Supabase project: SQL Editor -> paste -> Run.
-- Order: base schema first, then feature migrations.
-- ============================================================

-- ============================================================
-- supabase-schema.sql
-- ============================================================
-- Supabase SQL Schema for Distributor Dashboard
-- Run this in your Supabase SQL editor

-- Distributors table (linked to Supabase Auth)
create table public.distributors (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  verified boolean not null default false,
  verification_token uuid default gen_random_uuid(),
  verified_at timestamptz,
  onboarded boolean not null default false,
  is_super_admin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

create index distributors_verification_token_idx
  on public.distributors (verification_token);

alter table public.distributors enable row level security;

create policy "Distributors can read own row"
  on public.distributors for select
  using (auth.uid() = id);

create policy "Distributors can update own row"
  on public.distributors for update
  using (auth.uid() = id);

-- Branding table
create table public.branding (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references public.distributors(id) on delete cascade,
  app_name text not null default 'EA NAPTUNE',
  glow_color text not null default '#FFFFFF',
  logo_url text,
  robot_image_url text,
  tagline text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(distributor_id)
);

alter table public.branding enable row level security;

create policy "Distributors can manage own branding"
  on public.branding for all
  using (auth.uid() = distributor_id);

-- Public read for mobile app API
create policy "Public can read branding by distributor"
  on public.branding for select
  using (true);

-- EAs (Expert Advisors / Trading Bots)
create table public.eas (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references public.distributors(id) on delete cascade,
  name text not null,
  description text,
  mentor_id text not null unique,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.eas enable row level security;

create policy "Distributors can manage own EAs"
  on public.eas for all
  using (auth.uid() = distributor_id);

create policy "Public can read active EAs"
  on public.eas for select
  using (is_active = true);

-- App Users (people using the mobile app)
create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references public.distributors(id) on delete cascade,
  ea_id uuid not null references public.eas(id) on delete cascade,
  email text not null,
  is_active boolean default true,
  license_key text,
  license_sent_at timestamptz,
  created_at timestamptz default now(),
  last_seen timestamptz,
  unique(ea_id, email)
);

create unique index app_users_license_key_idx
  on public.app_users (license_key)
  where license_key is not null;

alter table public.app_users enable row level security;

create policy "Distributors can manage own app users"
  on public.app_users for all
  using (auth.uid() = distributor_id);

-- Runtime-managed super-admin allowlist (add admins by email at any time)
create table public.admin_emails (
  email text primary key,
  created_at timestamptz default now()
);
alter table public.admin_emails enable row level security;
-- No public policies: only the service role touches it.

insert into public.admin_emails (email) values ('respondsetausi@gmail.com')
  on conflict do nothing;

-- Auto-create distributor profile + default branding on signup.
-- Auto-flags the distributor as super-admin if their email is on the allowlist.
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_distributor();

-- Storage bucket for uploads
insert into storage.buckets (id, name, public) values ('assets', 'assets', true)
on conflict do nothing;

create policy "Authenticated users can upload"
  on storage.objects for insert
  with check (auth.role() = 'authenticated' and bucket_id = 'assets');

create policy "Authenticated users can update own"
  on storage.objects for update
  using (auth.role() = 'authenticated' and bucket_id = 'assets');

create policy "Public can read assets"
  on storage.objects for select
  using (bucket_id = 'assets');

-- ============================================================
-- supabase-verification-migration.sql
-- ============================================================
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

-- ============================================================
-- supabase-admin-migration.sql
-- ============================================================
-- Migration: super-admin + account suspension
-- Run this in your Supabase SQL editor on an existing project.

-- Super-admin flag (god-mode) and an active/suspended flag on distributors.
alter table public.distributors
  add column if not exists is_super_admin boolean not null default false,
  add column if not exists is_active boolean not null default true;

-- Grant the known super-admin (no-op until that account exists; the app also
-- auto-grants on login for any email in SUPER_ADMIN_EMAILS).
update public.distributors
  set is_super_admin = true
  where lower(email) = 'respondsetausi@gmail.com';

-- ============================================================
-- supabase-admin-emails-migration.sql
-- ============================================================
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

-- ============================================================
-- supabase-license-migration.sql
-- ============================================================
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

-- ============================================================
-- supabase-instant-activation-migration.sql
-- ============================================================
-- Instant Activation robot switch.
--
-- Adds a flag on the eas table so a super admin can designate exactly which
-- trading bot backs the public /activate flow (the "EA NAPTUNE SCALPER" robot).
-- App logic keeps at most one bot flagged at a time. Until this migration is
-- run, Instant Activation falls back to the INSTANT_ACTIVATION_MENTOR_ID env var or a
-- bot literally named "EA NAPTUNE SCALPER".

alter table public.eas
  add column if not exists is_instant_activation boolean not null default false;

-- Partial index: fast lookup of the single flagged bot.
create index if not exists eas_is_instant_activation_idx
  on public.eas (is_instant_activation)
  where is_instant_activation;

-- ============================================================
-- supabase-analytics-events-migration.sql
-- ============================================================
-- Event capture for site-traffic analytics (doc item 3): website visits and
-- logins over time. Sign-ups are already derived from registration dates, so
-- they don't need events. Run this in the Supabase SQL editor. Idempotent.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,   -- 'visit' | 'login'
  visitor_id text,            -- anonymous id (localStorage) for unique/returning counts
  email text,                 -- optional (who) — set for logins
  path text,                  -- optional page path for visits
  occurred_at timestamptz not null default now()
);

create index if not exists analytics_events_type_time_idx
  on public.analytics_events (event_type, occurred_at desc);

create index if not exists analytics_events_visitor_idx
  on public.analytics_events (visitor_id);

-- ============================================================
-- supabase-mt5-connections-migration.sql
-- ============================================================
-- MT5 connection tracking: which app users have successfully connected an
-- MT5 account. Stores the login number and server ONLY — never the password.
-- Run this in the Supabase SQL editor.

create table if not exists public.mt5_connections (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  login text not null,
  server text not null,
  first_connected_at timestamptz default now(),
  last_connected_at timestamptz default now(),
  connect_count integer default 1,
  unique(email, login, server)
);

create index if not exists mt5_connections_email_idx on public.mt5_connections (email);

alter table public.mt5_connections enable row level security;
-- No public policies: only the service-role key (API routes) can read/write.

-- ============================================================
-- supabase-mt5-connections-app-migration.sql
-- ============================================================
-- Add per-app separation to mt5_connections so the Super Admin can tell which
-- app each connected account came from (EA NAPTUNE, ea-converter, …).
-- Run this in the Supabase SQL editor. Idempotent.

alter table public.mt5_connections
  add column if not exists app text not null default 'ea-naptune';

-- Each (email, login, server, app) is now a distinct connection row, so the
-- same MT5 account connected from two different apps shows once per app.
alter table public.mt5_connections
  drop constraint if exists mt5_connections_email_login_server_key;
alter table public.mt5_connections
  add constraint mt5_connections_email_login_server_app_key
  unique (email, login, server, app);

-- ============================================================
-- supabase-mt5-connections-status-migration.sql
-- ============================================================
-- Live connection status for mt5_connections.
-- Adds an explicit status + a heartbeat timestamp so the Super Admin can show
-- ONLINE vs OFFLINE per MT5 account and count them in analytics.
-- "Online" = status = 'connected' AND last_heartbeat_at is within the freshness
-- window (the app pings a heartbeat while its session is live). Run in Supabase.
-- Idempotent.

alter table public.mt5_connections
  add column if not exists status text not null default 'connected';

alter table public.mt5_connections
  add column if not exists last_heartbeat_at timestamptz;

-- Backfill existing rows so they don't all show "online" right after migration —
-- seed the heartbeat with the last known connect time (likely stale = offline).
update public.mt5_connections
  set last_heartbeat_at = last_connected_at
  where last_heartbeat_at is null;

-- ============================================================
-- supabase-password-reset-migration.sql
-- ============================================================
-- Password reset for distributors (mentors / hosters / admins).
--
-- Login uses Supabase Auth passwords; this adds a short-lived reset token on the
-- distributor row so we can deliver a reset link via Brevo (same reliable path
-- as verification emails) and then set the new password through the Auth admin
-- API. Tokens are single-use and expire.

alter table public.distributors
  add column if not exists reset_token text,
  add column if not exists reset_expires_at timestamptz;

create index if not exists distributors_reset_token_idx
  on public.distributors (reset_token)
  where reset_token is not null;
