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
