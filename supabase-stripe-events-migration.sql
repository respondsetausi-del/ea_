-- ============================================================
-- Stripe webhook idempotency, done properly.
--
-- The first attempt keyed on app_users.stripe_session_id: before granting
-- access, look for a row already carrying this session id. That column holds
-- only the LATEST payment, so it is overwritten on every subsequent one — and
-- once overwritten, a redelivery of the earlier event finds nothing and is
-- processed again, granting another full access window.
--
-- Stripe retries failed deliveries with backoff for up to three days. This
-- endpoint returned 404 before it was deployed and 503 before the signing
-- secret was set, so a batch of retries arrived after it started working.
-- At least one account ended up with four windows stacked from one payment.
--
-- Correct key is the EVENT id: Stripe reuses it across every retry of the same
-- event, and it is never mutated by us. A dedicated table means the record of
-- "already handled" cannot be clobbered by later activity.
--
-- Safe to re-run. Paste into the Supabase SQL editor.
-- ============================================================

create table if not exists public.stripe_events (
  event_id       text primary key,
  event_type     text,
  session_id     text,
  email          text,
  -- Stripe's own figures, kept as evidence. Reaching the insert at all means
  -- the request carried a signature that verified against
  -- STRIPE_WEBHOOK_SECRET, so a row here is proof of a genuine Stripe call.
  amount_total   bigint,
  currency       text,
  livemode       boolean,
  payment_status text,
  payment_intent text,
  processed_at   timestamptz not null default now()
);

-- Added separately so re-running against an earlier version of this table
-- picks up the evidence columns instead of silently skipping them.
alter table public.stripe_events add column if not exists amount_total   bigint;
alter table public.stripe_events add column if not exists currency       text;
alter table public.stripe_events add column if not exists livemode       boolean;
alter table public.stripe_events add column if not exists payment_status text;
alter table public.stripe_events add column if not exists payment_intent text;

comment on table public.stripe_events is
  'Every Stripe event we have acted on. Insert succeeds once; a duplicate '
  'insert means this is a retry and must not grant access again.';

create index if not exists stripe_events_session_idx
  on public.stripe_events (session_id);

alter table public.stripe_events enable row level security;
-- No policies: only the service role (our webhook) touches this.


-- ── Backfill ──
-- Records the sessions we already know about, so a retry of one of those
-- events after this deploy is still recognised. Only the latest session per
-- user survived in app_users, so earlier ones can't be recovered — this
-- narrows the window rather than closing it retroactively.
insert into public.stripe_events (event_id, event_type, session_id, email, processed_at)
select
  'backfill:' || stripe_session_id,
  'checkout.session.completed',
  stripe_session_id,
  email,
  coalesce(paid_at, now())
from public.app_users
where stripe_session_id is not null
on conflict (event_id) do nothing;


-- ── Who may have been over-granted ──
-- Anything materially past one window from its last payment is suspect.
-- Cross-check these against the payments actually visible in Stripe before
-- correcting anything: a genuine renewal looks identical from here.
select
  email,
  paid_at,
  access_expires_at,
  round(extract(epoch from (access_expires_at - paid_at)) / 86400) as days_granted,
  stripe_session_id
from public.app_users
where paid_at is not null
  and access_expires_at is not null
order by days_granted desc;
