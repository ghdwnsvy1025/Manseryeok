-- P0: user_profiles, saju_profiles, diary_entries enrichment

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  locale text default 'ko-KR',
  timezone text default 'Asia/Seoul',
  active_saju_profile_id uuid,
  schema_version integer not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saju_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  is_primary boolean not null default true,
  birth_date date not null,
  birth_hour integer,
  birth_minute integer,
  birth_time_unknown boolean not null default true,
  calendar_type text not null default 'solar',
  is_leap_month boolean default false,
  gender text,
  timezone text not null default 'Asia/Seoul',
  location_name text,
  longitude double precision,
  latitude double precision,
  day_change_rule text not null default 'midnight',
  time_correction text not null default 'none',
  pillars jsonb not null,
  calculation_version text not null default '0.1.0',
  input_hash text,
  solar_term_boundary jsonb,
  calculation_metadata jsonb,
  reconstructed boolean not null default false,
  schema_version integer not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists saju_profiles_one_primary_per_user
  on public.saju_profiles (user_id)
  where is_primary = true;

alter table public.user_profiles
  drop constraint if exists user_profiles_active_saju_profile_id_fkey;

alter table public.user_profiles
  add constraint user_profiles_active_saju_profile_id_fkey
  foreign key (active_saju_profile_id)
  references public.saju_profiles(id)
  on delete set null;

alter table public.diary_entries
  add column if not exists happiness_rating smallint,
  add column if not exists emotions text[] not null default '{}',
  add column if not exists tags text[] not null default '{}',
  add column if not exists heavenly_stem text,
  add column if not exists earthly_branch text,
  add column if not exists weekday smallint,
  add column if not exists is_weekend boolean,
  add column if not exists sleep_score smallint,
  add column if not exists exercise_status text,
  add column if not exists social_activity text,
  add column if not exists weather_metadata jsonb,
  add column if not exists input_mode text,
  add column if not exists emotion_source text,
  add column if not exists saju_depth text,
  add column if not exists user_birth_pillars jsonb,
  add column if not exists saju_profile_id uuid references public.saju_profiles(id) on delete set null,
  add column if not exists schema_version integer not null default 2;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'diary_entries_happiness_rating_check'
  ) then
    alter table public.diary_entries
      add constraint diary_entries_happiness_rating_check
      check (happiness_rating is null or happiness_rating between 1 and 5);
  end if;
end $$;

-- Backfill happiness from scores.daily_wellbeing_score when possible
update public.diary_entries
set happiness_rating = case
  when (scores->>'daily_wellbeing_score')::numeric <= 12 then 1
  when (scores->>'daily_wellbeing_score')::numeric <= 37 then 2
  when (scores->>'daily_wellbeing_score')::numeric <= 62 then 3
  when (scores->>'daily_wellbeing_score')::numeric <= 87 then 4
  when (scores->>'daily_wellbeing_score')::numeric is not null then 5
  else coalesce(happiness_rating, 3)
end
where happiness_rating is null;

update public.diary_entries
set
  heavenly_stem = coalesce(heavenly_stem, day_pillar->'stem'->>'ko'),
  earthly_branch = coalesce(earthly_branch, day_pillar->'branch'->>'ko'),
  weekday = coalesce(weekday, extract(dow from date)::smallint),
  is_weekend = coalesce(
    is_weekend,
    extract(dow from date) in (0, 6)
  );

create index if not exists diary_entries_user_date_idx
  on public.diary_entries (user_id, date desc);

create index if not exists diary_entries_user_stem_idx
  on public.diary_entries (user_id, heavenly_stem);

create index if not exists diary_entries_user_branch_idx
  on public.diary_entries (user_id, earthly_branch);

create index if not exists diary_entries_user_tags_idx
  on public.diary_entries using gin (tags);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists diary_entries_set_updated_at on public.diary_entries;
create trigger diary_entries_set_updated_at
  before update on public.diary_entries
  for each row execute function public.set_updated_at();

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists saju_profiles_set_updated_at on public.saju_profiles;
create trigger saju_profiles_set_updated_at
  before update on public.saju_profiles
  for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.saju_profiles enable row level security;

drop policy if exists "Users can read own profile" on public.user_profiles;
create policy "Users can read own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.user_profiles;
create policy "Users can insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can delete own profile" on public.user_profiles;
create policy "Users can delete own profile"
  on public.user_profiles for delete
  using (auth.uid() = id);

drop policy if exists "Users can read own saju profiles" on public.saju_profiles;
create policy "Users can read own saju profiles"
  on public.saju_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own saju profiles" on public.saju_profiles;
create policy "Users can insert own saju profiles"
  on public.saju_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own saju profiles" on public.saju_profiles;
create policy "Users can update own saju profiles"
  on public.saju_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own saju profiles" on public.saju_profiles;
create policy "Users can delete own saju profiles"
  on public.saju_profiles for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can update own diary entries" on public.diary_entries;
create policy "Users can update own diary entries"
  on public.diary_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
