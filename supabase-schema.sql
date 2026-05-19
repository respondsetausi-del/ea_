-- Supabase SQL Schema for Distributor Dashboard
-- Run this in your Supabase SQL editor

-- Distributors table (linked to Supabase Auth)
create table public.distributors (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  created_at timestamptz default now()
);

alter table public.distributors enable row level security;

create policy "Distributors can read own row"
  on public.distributors for select
  using (auth.uid() = id);

create policy "Distributors can update own row"
  on public.distributors for update
  using (auth.uid() = id);

-- Branding table
create table public.branding (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references public.distributors(id) on delete cascade,
  app_name text not null default 'Free Robot',
  glow_color text not null default '#FFFFFF',
  logo_url text,
  robot_image_url text,
  tagline text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(distributor_id)
);

alter table public.branding enable row level security;

create policy "Distributors can manage own branding"
  on public.branding for all
  using (auth.uid() = distributor_id);

-- Public read for mobile app API
create policy "Public can read branding by distributor"
  on public.branding for select
  using (true);

-- EAs (Expert Advisors / Trading Bots)
create table public.eas (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references public.distributors(id) on delete cascade,
  name text not null,
  description text,
  mentor_id text not null unique,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.eas enable row level security;

create policy "Distributors can manage own EAs"
  on public.eas for all
  using (auth.uid() = distributor_id);

create policy "Public can read active EAs"
  on public.eas for select
  using (is_active = true);

-- App Users (people using the mobile app)
create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references public.distributors(id) on delete cascade,
  ea_id uuid not null references public.eas(id) on delete cascade,
  email text not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  last_seen timestamptz,
  unique(ea_id, email)
);

alter table public.app_users enable row level security;

create policy "Distributors can manage own app users"
  on public.app_users for all
  using (auth.uid() = distributor_id);

-- Auto-create distributor profile + default branding on signup
create or replace function public.handle_new_distributor()
returns trigger as $$
begin
  insert into public.distributors (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));

  insert into public.branding (distributor_id, app_name)
  values (new.id, 'Free Robot');

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_distributor();

-- Storage bucket for uploads
insert into storage.buckets (id, name, public) values ('assets', 'assets', true)
on conflict do nothing;

create policy "Authenticated users can upload"
  on storage.objects for insert
  with check (auth.role() = 'authenticated' and bucket_id = 'assets');

create policy "Authenticated users can update own"
  on storage.objects for update
  using (auth.role() = 'authenticated' and bucket_id = 'assets');

create policy "Public can read assets"
  on storage.objects for select
  using (bucket_id = 'assets');
