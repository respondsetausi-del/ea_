-- ============================================================
-- Rebrand migration: drop the legacy "free" naming.
--
-- The other *-migration.sql files are the CREATE scripts — editing them only
-- affects fresh setups. This one fixes databases that already ran the old
-- versions, so it renames in place rather than creating. Idempotent: safe to
-- run more than once, and safe on a database that never had the old names.
--
-- Run in the Supabase SQL editor.
-- ============================================================


-- ── 1. eas.is_free_activation → is_instant_activation ──
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'eas'
      and column_name  = 'is_free_activation'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'eas'
      and column_name  = 'is_instant_activation'
  ) then
    alter table public.eas rename column is_free_activation to is_instant_activation;
  end if;
end $$;

alter index if exists public.eas_is_free_activation_idx
  rename to eas_is_instant_activation_idx;


-- ── 2. mt5_connections.app: 'free-app' → 'ea-naptune' ──
-- The unique key is (email, login, server, app), so a straight UPDATE would
-- fail where the same MT5 account already has an 'ea-naptune' row. Those rows
-- are skipped rather than deleted — see the audit query at the bottom.
alter table public.mt5_connections
  alter column app set default 'ea-naptune';

update public.mt5_connections m
   set app = 'ea-naptune'
 where m.app = 'free-app'
   and not exists (
     select 1
       from public.mt5_connections x
      where x.email  = m.email
        and x.login  = m.login
        and x.server = m.server
        and x.app    = 'ea-naptune'
   );


-- ── 3. branding.app_name: 'Free Robot' → 'EA NAPTUNE' ──
-- Only rewrites rows still holding the old default; custom names are left alone.
alter table public.branding
  alter column app_name set default 'EA NAPTUNE';

update public.branding
   set app_name = 'EA NAPTUNE'
 where app_name = 'Free Robot';


-- ── 4. Audit: rows this migration could not convert ──
-- Expect zero. Any row listed here is an MT5 account that was connected from
-- BOTH the legacy client and the current one; decide per row which to keep.
select email, login, server, app
  from public.mt5_connections
 where app = 'free-app';
