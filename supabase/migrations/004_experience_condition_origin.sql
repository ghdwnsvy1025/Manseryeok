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
