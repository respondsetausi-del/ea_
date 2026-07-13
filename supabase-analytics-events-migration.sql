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
