-- ============================================================
-- Who may grant app access, and on what terms.
--
-- Three problems this fixes:
--
-- 1. A mentor could approve their own clients. RLS grants them `for all` on
--    their own app_users rows, so although the dashboard writes
--    status = 'pending', nothing stopped a crafted request setting
--    'approved' — the UI was the only gate, and the UI is not a boundary.
--
-- 2. Access always required an EA. ea_id was NOT NULL, so "let this email in,
--    I'll give them a bot later" could not be expressed.
--
-- 3. Adding a user as super admin still landed in the approval queue, so you
--    had to approve your own additions.
--
-- Resulting rules:
--   added by super/staff admin  -> approved immediately
--   created by the Stripe hook  -> approved immediately (auto_approve_on_payment)
--   added by a mentor           -> pending, no access until an admin approves
--   nobody acted, no payment    -> no access
--
-- Safe to re-run. Paste into the Supabase SQL editor.
-- ============================================================


-- ── 1. Access without a bot ──
-- A row with no ea_id is a user who may sign in but has no licence yet; they
-- sit on the app's licence screen until one is issued.
alter table public.app_users
  alter column ea_id drop not null;

comment on column public.app_users.ea_id is
  'The bot this licence is for. NULL = access granted, no bot assigned yet.';

-- unique(ea_id, email) does not constrain NULLs, so without this a user could
-- be added bot-less repeatedly.
create unique index if not exists app_users_email_no_ea_idx
  on public.app_users (lower(email))
  where ea_id is null;


-- ── 2. Approval is server-side only ──
-- Distributors keep full control of their own rows, except the columns that
-- decide access. Those may only be written by the service role — i.e. by our
-- API routes, which check the caller's admin role first.
--
-- A trigger rather than column GRANTs: it survives the table being recreated
-- by a future migration, and it can preserve prior values on UPDATE instead of
-- rejecting the whole statement (so a mentor editing a row doesn't error).
create or replace function public.enforce_app_user_access_fields()
returns trigger as $$
begin
  -- Two legitimate writers:
  --   service_role — our API routes, which have already checked the caller's
  --                  admin tier before deciding what the row may say
  --   postgres / supabase_admin — a direct console session, i.e. the owner in
  --                  the SQL editor
  --
  -- The console case is not optional. Checking only auth.role() silently
  -- reverted every manual correction made in the Supabase SQL editor: the
  -- UPDATE reported success, the trigger copied the old value back, and the
  -- data never changed. Fixing access by hand has to keep working.
  if auth.role() = 'service_role'
     or current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status            := 'pending';
    new.approved_at       := null;
    new.approved_by       := null;
    new.access_expires_at := null;
    new.paid_at           := null;
    new.stripe_session_id := null;
  else
    -- Silently keep whatever was there; the write still succeeds for the
    -- columns a distributor is allowed to change (email, ea_id, is_active).
    new.status            := old.status;
    new.approved_at       := old.approved_at;
    new.approved_by       := old.approved_by;
    new.access_expires_at := old.access_expires_at;
    new.paid_at           := old.paid_at;
    new.stripe_session_id := old.stripe_session_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists app_users_enforce_access_fields on public.app_users;
create trigger app_users_enforce_access_fields
  before insert or update on public.app_users
  for each row execute function public.enforce_app_user_access_fields();


-- ── 3. Check ──
-- Everyone who currently has access, and how they got it.
select
  u.email,
  u.status,
  u.is_active,
  coalesce(e.name, '— no bot —') as bot,
  u.paid_at is not null          as paid,
  u.approved_by,
  u.access_expires_at
from public.app_users u
left join public.eas e on e.id = u.ea_id
order by u.status, u.email;
