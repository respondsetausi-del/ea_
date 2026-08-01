-- Instant Activation robot switch.
--
-- Adds a flag on the eas table so a super admin can designate exactly which
-- trading bot backs the public /activate flow (the "EA ACCESS SCALPER" robot).
-- App logic keeps at most one bot flagged at a time. Until this migration is
-- run, Instant Activation falls back to the INSTANT_ACTIVATION_MENTOR_ID env var or a
-- bot literally named "EA ACCESS SCALPER".

alter table public.eas
  add column if not exists is_instant_activation boolean not null default false;

-- Partial index: fast lookup of the single flagged bot.
create index if not exists eas_is_instant_activation_idx
  on public.eas (is_instant_activation)
  where is_instant_activation;
