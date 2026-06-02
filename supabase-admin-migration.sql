-- Migration: super-admin + account suspension
-- Run this in your Supabase SQL editor on an existing project.

-- Super-admin flag (god-mode) and an active/suspended flag on distributors.
alter table public.distributors
  add column if not exists is_super_admin boolean not null default false,
  add column if not exists is_active boolean not null default true;

-- Grant the known super-admin (no-op until that account exists; the app also
-- auto-grants on login for any email in SUPER_ADMIN_EMAILS).
update public.distributors
  set is_super_admin = true
  where lower(email) = 'respondsetausi@gmail.com';
