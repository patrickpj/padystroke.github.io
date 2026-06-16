create table if not exists public.pipicat_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  app_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.pipicat_profiles enable row level security;

drop policy if exists "Users can read own pipicat data" on public.pipicat_profiles;
create policy "Users can read own pipicat data"
  on public.pipicat_profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own pipicat data" on public.pipicat_profiles;
create policy "Users can insert own pipicat data"
  on public.pipicat_profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own pipicat data" on public.pipicat_profiles;
create policy "Users can update own pipicat data"
  on public.pipicat_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
