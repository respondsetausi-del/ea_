-- Add per-app separation to mt5_connections so the Super Admin can tell which
-- app each connected account came from (Free-App, ea-converter, …).
-- Run this in the Supabase SQL editor. Idempotent.

alter table public.mt5_connections
  add column if not exists app text not null default 'free-app';

-- Each (email, login, server, app) is now a distinct connection row, so the
-- same MT5 account connected from two different apps shows once per app.
alter table public.mt5_connections
  drop constraint if exists mt5_connections_email_login_server_key;
alter table public.mt5_connections
  add constraint mt5_connections_email_login_server_app_key
  unique (email, login, server, app);
