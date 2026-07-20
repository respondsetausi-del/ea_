-- Password reset for distributors (mentors / hosters / admins).
--
-- Login uses Supabase Auth passwords; this adds a short-lived reset token on the
-- distributor row so we can deliver a reset link via Brevo (same reliable path
-- as verification emails) and then set the new password through the Auth admin
-- API. Tokens are single-use and expire.

alter table public.distributors
  add column if not exists reset_token text,
  add column if not exists reset_expires_at timestamptz;

create index if not exists distributors_reset_token_idx
  on public.distributors (reset_token)
  where reset_token is not null;
