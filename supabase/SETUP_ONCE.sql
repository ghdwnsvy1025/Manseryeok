-- One-shot setup for Manseryeok (run in Supabase SQL Editor)
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS

-- ===== supabase\migrations\001_diary_entries.sql =====
-- Supabase SQL: ?쇨린 ?뚯씠釉?(Dashboard ??SQL Editor?먯꽌 ?ㅽ뻾)

create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  content text not null default '',
  day_pillar jsonb not null,
  month_pillar_ko text,
  scores jsonb,
  ai_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists diary_entries_user_day_pillar_idx
  on public.diary_entries (user_id, (day_pillar->>'ganjiKo'));

create index if not exists diary_entries_user_updated_idx
  on public.diary_entries (user_id, updated_at desc);

alter table public.diary_entries enable row level security;

drop policy if exists "Users can read own diary entries" on public.diary_entries;
create policy "Users can read own diary entries"
  on public.diary_entries for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own diary entries" on public.diary_entries;
create policy "Users can insert own diary entries"
  on public.diary_entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own diary entries" on public.diary_entries;
create policy "Users can update own diary entries"
  on public.diary_entries for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own diary entries" on public.diary_entries;
create policy "Users can delete own diary entries"
  on public.diary_entries for delete
  using (auth.uid() = user_id);


-- ===== supabase\migrations\002_year_pillar_ko.sql =====
-- ?꾩슫(?꾩＜) ?쒓? 媛꾩? ???

alter table public.diary_entries
  add column if not exists year_pillar_ko text;


-- ===== supabase\migrations\003_p0_profiles_and_diary_fields.sql =====
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


-- ===== supabase\migrations\004_experience_condition_origin.sql =====
-- P1: experience mode, condition rating, data origin, lifestyle enums

alter table public.user_profiles
  add column if not exists experience_mode text,
  add column if not exists onboarding_completed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_experience_mode_check'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_experience_mode_check
      check (experience_mode is null or experience_mode in ('beginner', 'expert'));
  end if;
end $$;

alter table public.diary_entries
  add column if not exists condition_rating smallint,
  add column if not exists happiness_source text,
  add column if not exists data_origin text not null default 'user',
  add column if not exists sleep_satisfaction text,
  add column if not exists activity_level text,
  add column if not exists social_met text,
  add column if not exists work_intensity text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'diary_entries_condition_rating_check'
  ) then
    alter table public.diary_entries
      add constraint diary_entries_condition_rating_check
      check (condition_rating is null or (condition_rating between 1 and 5));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'diary_entries_data_origin_check'
  ) then
    alter table public.diary_entries
      add constraint diary_entries_data_origin_check
      check (data_origin in ('user', 'import', 'demo'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'diary_entries_happiness_source_check'
  ) then
    alter table public.diary_entries
      add constraint diary_entries_happiness_source_check
      check (
        happiness_source is null
        or happiness_source in ('selected', 'backfilled', 'default')
      );
  end if;
end $$;

update public.diary_entries
set schema_version = greatest(coalesce(schema_version, 2), 3);

-- Note: demo rows are marked via data_origin in the app (IndexedDB demo ids are not UUIDs).
-- Do not use: where id like 'demo-%'  (id is uuid)


-- ===== supabase\migrations\005_forecast_mvp.sql =====
-- Phase 1: energy/primary area on diary + daily forecasts + feedback

alter table public.diary_entries
  add column if not exists energy_rating smallint,
  add column if not exists primary_area text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'diary_entries_energy_rating_check'
  ) then
    alter table public.diary_entries
      add constraint diary_entries_energy_rating_check
      check (energy_rating is null or (energy_rating between 1 and 4));
  end if;
end $$;

update public.diary_entries
set schema_version = greatest(coalesce(schema_version, 3), 4);

create table if not exists public.daily_forecasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_date date not null,
  source_entry_id uuid references public.diary_entries(id) on delete set null,
  source_entry_date date,
  saju_profile_id uuid references public.saju_profiles(id) on delete set null,
  payload jsonb not null,
  maturity text not null default 'base',
  generation_mode text not null default 'local',
  rule_version text not null,
  model_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, target_date)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'daily_forecasts_maturity_check'
  ) then
    alter table public.daily_forecasts
      add constraint daily_forecasts_maturity_check
      check (maturity in ('base', 'early', 'personal', 'flow'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'daily_forecasts_generation_mode_check'
  ) then
    alter table public.daily_forecasts
      add constraint daily_forecasts_generation_mode_check
      check (generation_mode in ('local', 'ai_assisted'));
  end if;
end $$;

create index if not exists daily_forecasts_user_date_idx
  on public.daily_forecasts (user_id, target_date desc);

create table if not exists public.forecast_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  forecast_id uuid not null references public.daily_forecasts(id) on delete cascade,
  target_date date not null,
  match_level text,
  action_executed boolean,
  action_helpfulness text,
  inner_signal_feedback text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, forecast_id)
);

create index if not exists forecast_feedback_user_date_idx
  on public.forecast_feedback (user_id, target_date desc);

drop trigger if exists daily_forecasts_set_updated_at on public.daily_forecasts;
create trigger daily_forecasts_set_updated_at
  before update on public.daily_forecasts
  for each row execute function public.set_updated_at();

drop trigger if exists forecast_feedback_set_updated_at on public.forecast_feedback;
create trigger forecast_feedback_set_updated_at
  before update on public.forecast_feedback
  for each row execute function public.set_updated_at();

alter table public.daily_forecasts enable row level security;
alter table public.forecast_feedback enable row level security;

drop policy if exists "Users can read own forecasts" on public.daily_forecasts;
create policy "Users can read own forecasts"
  on public.daily_forecasts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own forecasts" on public.daily_forecasts;
create policy "Users can insert own forecasts"
  on public.daily_forecasts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own forecasts" on public.daily_forecasts;
create policy "Users can update own forecasts"
  on public.daily_forecasts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own forecasts" on public.daily_forecasts;
create policy "Users can delete own forecasts"
  on public.daily_forecasts for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own forecast feedback" on public.forecast_feedback;
create policy "Users can read own forecast feedback"
  on public.forecast_feedback for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own forecast feedback" on public.forecast_feedback;
create policy "Users can insert own forecast feedback"
  on public.forecast_feedback for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own forecast feedback" on public.forecast_feedback;
create policy "Users can update own forecast feedback"
  on public.forecast_feedback for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own forecast feedback" on public.forecast_feedback;
create policy "Users can delete own forecast feedback"
  on public.forecast_feedback for delete
  using (auth.uid() = user_id);


-- ===== supabase\migrations\006_rag_knowledge.sql =====
-- Phase: RAG knowledge documents + pgvector for persistent saju theory

create extension if not exists vector;

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  char_count integer not null default 0,
  chunk_count integer not null default 0,
  status text not null default 'pending',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'knowledge_documents_status_check'
  ) then
    alter table public.knowledge_documents
      add constraint knowledge_documents_status_check
      check (status in ('pending', 'ready', 'error'));
  end if;
end $$;

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists knowledge_chunks_document_id_idx
  on public.knowledge_chunks (document_id);

create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks
  using hnsw (embedding vector_cosine_ops);

create index if not exists knowledge_documents_updated_at_idx
  on public.knowledge_documents (updated_at desc);

drop trigger if exists knowledge_documents_set_updated_at on public.knowledge_documents;
create trigger knowledge_documents_set_updated_at
  before update on public.knowledge_documents
  for each row execute function public.set_updated_at();

-- Similarity search RPC (service role / server only)
create or replace function public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_count integer default 5
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  chunk_index integer,
  similarity float
)
language sql
stable
as $$
  select
    c.id,
    c.document_id,
    c.content,
    c.chunk_index,
    (1 - (c.embedding <=> query_embedding))::float as similarity
  from public.knowledge_chunks c
  join public.knowledge_documents d on d.id = c.document_id
  where d.status = 'ready'
  order by c.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;

-- Default deny for anon/authenticated; server uses service role
drop policy if exists "No direct access to knowledge documents" on public.knowledge_documents;
drop policy if exists "No direct access to knowledge chunks" on public.knowledge_chunks;

-- Explicit deny policies are optional with RLS enabled and no grants;
-- revoke table privileges from anon/authenticated for clarity
revoke all on public.knowledge_documents from anon, authenticated;
revoke all on public.knowledge_chunks from anon, authenticated;
revoke all on function public.match_knowledge_chunks(vector, integer) from anon, authenticated;
grant execute on function public.match_knowledge_chunks(vector, integer) to service_role;
grant all on public.knowledge_documents to service_role;
grant all on public.knowledge_chunks to service_role;


