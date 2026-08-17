-- ── Licences stop being bound to an email ────────────────────────────────
--
-- A licence key identifies a ROBOT, not a person. It is issued against an EA
-- and handed to whoever the mentor is selling to, so the mentor often does not
-- know an address at the moment they generate it.
--
-- app_users.email was NOT NULL, which forced one to be invented, and
-- /api/v1/auth-license then required that invented address to match whatever
-- the user had signed in with. Those two strings were routinely different, so
-- valid keys were rejected as "Invalid License".
--
-- Access is still gated by email — that happens in /api/v1/authorize against
-- payment and approval. This only stops the KEY from carrying an identity.

alter table public.app_users
  alter column email drop not null;

-- The (ea_id, email) uniqueness stays. Postgres treats NULLs as distinct, so
-- any number of unassigned licences can exist on the same EA while a named
-- client is still limited to one row per bot.
