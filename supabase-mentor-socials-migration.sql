-- ── Mentor application: social reach, collected at signup ────────────────
--
-- A mentor's audience is the thing being judged when their application is
-- reviewed, and it was not being asked for anywhere — the super admin saw an
-- email address and a name and had to approve or refuse on that.
--
-- Collected once, at registration. All four are optional individually: a
-- mentor may run only Telegram, or only YouTube.

alter table public.distributors
  add column if not exists telegram_url text,
  add column if not exists discord_url  text,
  add column if not exists youtube_url  text,
  add column if not exists tiktok_url   text;

-- ── Signup lands pending ────────────────────────────────────────────────
--
-- `verified` is already the gate the login and dashboard read, and already
-- defaults to false, so a new mentor is pending the moment they sign up. What
-- was missing: the trigger never carried the social links across, so they were
-- captured at registration and then dropped.
--
-- Super admins are exempt. Without this an owner signing in on a fresh
-- database would be pending with nobody able to approve them.

create or replace function public.handle_new_distributor()
returns trigger as $$
declare
  is_admin boolean;
begin
  is_admin := exists (
    select 1 from public.admin_emails a where lower(a.email) = lower(new.email)
  );

  insert into public.distributors (
    id, email, name, is_super_admin, verified, verified_at,
    telegram_url, discord_url, youtube_url, tiktok_url
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    is_admin,
    is_admin,
    case when is_admin then now() else null end,
    nullif(trim(new.raw_user_meta_data->>'telegram_url'), ''),
    nullif(trim(new.raw_user_meta_data->>'discord_url'),  ''),
    nullif(trim(new.raw_user_meta_data->>'youtube_url'),  ''),
    nullif(trim(new.raw_user_meta_data->>'tiktok_url'),   '')
  );

  insert into public.branding (distributor_id, app_name)
  values (new.id, 'EA NAPTUNE');

  return new;
end;
$$ language plpgsql security definer;

-- Queue ordering. distributors.created_at is the application time, so the
-- 24-hour review clock is read from it directly — no extra column.
create index if not exists distributors_pending_idx
  on public.distributors (created_at desc)
  where verified = false;
