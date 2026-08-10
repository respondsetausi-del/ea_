-- ============================================================
-- Delegated ("staff") admin.
--
-- Admin access was all-or-nothing: is_super_admin granted god mode — suspend
-- and delete any account, grant admin to anyone, flip platform settings. There
-- was no way to let someone help with the approval queue without handing them
-- the ability to delete the platform.
--
-- A staff admin can:
--   • see mentors and paid clients
--   • approve / reject mentor signups and client requests
--
-- and cannot:
--   • suspend, delete or reset any account
--   • grant or revoke admin
--   • change platform settings (payment switch, instant activation)
--   • see the admin list or the MQTT monitor
--
-- Enforced server-side in src/lib/admin.ts, not just hidden in the UI.
--
-- Safe to re-run. Paste into the Supabase SQL editor.
-- ============================================================

alter table public.distributors
  add column if not exists is_staff_admin boolean not null default false;

comment on column public.distributors.is_staff_admin is
  'Delegated admin: may view mentors/paid clients and approve them. Not god mode — see is_super_admin.';

create index if not exists distributors_staff_admin_idx
  on public.distributors (is_staff_admin)
  where is_staff_admin = true;


-- Who currently has which tier.
select
  email,
  name,
  case
    when is_super_admin then 'super admin'
    when is_staff_admin then 'staff admin'
    else '—'
  end as admin_tier,
  verified,
  is_active
from public.distributors
where is_super_admin or is_staff_admin
order by is_super_admin desc, email;
