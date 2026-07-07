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
