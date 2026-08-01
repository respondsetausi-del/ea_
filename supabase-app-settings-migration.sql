-- ============================================================
-- Platform settings, controlled by the super admin.
--
-- First setting: require_payment. When false, a client added by a mentor and
-- approved gets in without Stripe ever appearing in the app — useful for
-- comped clients, promos, or while payments are being reconfigured.
--
-- Idempotent. Run in the Supabase SQL editor.
-- ============================================================

create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Default to requiring payment, so enabling this table changes nothing until
-- the super admin actually flips the switch.
insert into public.app_settings (key, value)
values ('require_payment', 'true'::jsonb)
on conflict (key) do nothing;

-- Read by /api/v1/authorize (service role) and the admin dashboard only.
alter table public.app_settings enable row level security;

-- No public policies: the anon key cannot read or write this table. The API
-- routes use the service-role key, which bypasses RLS.


-- ── First-login tracking ──
-- last_seen already records the most recent login; this pins the first one, so
-- the dashboard can distinguish "never logged in" from "logged in once, long
-- ago" without losing the original date.
alter table public.app_users
  add column if not exists first_login_at timestamptz;
