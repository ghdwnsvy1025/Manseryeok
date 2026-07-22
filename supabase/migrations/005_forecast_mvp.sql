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
