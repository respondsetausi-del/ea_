-- Engine memory for the EA NAPTUNE app server (see src/app/api/v1/engine-store/route.ts).
-- Only the service role touches it: RLS on, no policies, so anon/authenticated keys get nothing.
create table if not exists public.engine_store (
  kind text not null check (kind in ('strategy', 'session')),
  key text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (kind, key)
);
alter table public.engine_store enable row level security;
