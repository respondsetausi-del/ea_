-- EA NAPTUNE: Whop webhook support.
-- Run in the Supabase SQL editor. Safe to run twice.

-- 1. Delivery ledger, so a repeated delivery cannot grant a second window.
--    Whop delivers at least once by design, so duplicates are expected.
--    The webhook claims a row here BEFORE granting anything; a unique
--    violation on event_id is how it recognises a retry.
CREATE TABLE IF NOT EXISTS public.whop_events (
  event_id      text PRIMARY KEY,
  event_type    text,
  membership_id text,
  plan_id       text,
  email         text,
  received_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whop_events_email_idx ON public.whop_events (email);
CREATE INDEX IF NOT EXISTS whop_events_received_idx ON public.whop_events (received_at DESC);

-- Service-role only. Nothing in the browser should ever read this.
ALTER TABLE public.whop_events ENABLE ROW LEVEL SECURITY;

-- 2. Which Whop membership granted a user's access, so a later
--    membership.deactivated can withdraw exactly what we gave and nothing else.
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS whop_membership_id text;

CREATE INDEX IF NOT EXISTS app_users_whop_membership_idx
  ON public.app_users (whop_membership_id);

-- 3. Read-back, so this is not a migration that reports success while doing
--    nothing. Both rows must say true.
SELECT 'whop_events table' AS checked,
       to_regclass('public.whop_events') IS NOT NULL AS ok
UNION ALL
SELECT 'app_users.whop_membership_id',
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'app_users'
           AND column_name = 'whop_membership_id'
       );
