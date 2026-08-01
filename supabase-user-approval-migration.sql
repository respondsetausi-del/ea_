-- ============================================================
-- Client approval queue for app_users.
--
-- Flow this supports:
--   mentor adds client  →  status 'pending'
--   client pays in-app  →  paid_at / stripe_session_id recorded
--   super admin approves →  status 'approved'  →  client can log in
--
-- Idempotent. Run in the Supabase SQL editor.
-- ============================================================


-- ── 1. Approval state ──
-- Added with default 'approved' so every EXISTING user keeps working; the
-- default then flips to 'pending' so newly added clients raise a request.
alter table public.app_users
  add column if not exists status text not null default 'approved';

alter table public.app_users
  alter column status set default 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'app_users_status_check'
  ) then
    alter table public.app_users
      add constraint app_users_status_check
      check (status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

create index if not exists app_users_status_idx
  on public.app_users (status);


-- ── 2. Payment record ──
-- Set when Stripe confirms a successful payment for this client, so the super
-- admin can see "paid" next to the Approve button before deciding.
alter table public.app_users
  add column if not exists paid_at timestamptz;

alter table public.app_users
  add column if not exists stripe_session_id text;

create unique index if not exists app_users_stripe_session_idx
  on public.app_users (stripe_session_id)
  where stripe_session_id is not null;


-- ── 3. access_via ──
-- Read by /api/admin/overview and written by /api/v1/register, but no previous
-- migration ever created it. Added here so those code paths are safe.
alter table public.app_users
  add column if not exists access_via text not null default 'manual';


-- ── 4. Approval audit ──
alter table public.app_users
  add column if not exists approved_at timestamptz;

alter table public.app_users
  add column if not exists approved_by text;


-- ── 5. Case-insensitive email lookup ──
-- /api/v1/authorize resolves a client by email alone, with no mentor id.
create index if not exists app_users_email_lower_idx
  on public.app_users (lower(email));
