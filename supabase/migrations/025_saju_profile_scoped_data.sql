-- 025: Scope journal / daily insight / prefs / onboarding by saju_profile_id
-- Existing rows backfill to each user's primary (or oldest) saju profile (2A).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.resolve_primary_saju_profile_id(p_user_id uuid)
returns uuid
language sql
stable
as $$
  select coalesce(
    (
      select id
      from public.saju_profiles
      where user_id = p_user_id and is_primary = true
      limit 1
    ),
    (
      select id
      from public.saju_profiles
      where user_id = p_user_id
      order by created_at asc
      limit 1
    )
  );
$$;

-- Users with scoped data but no saju profile get a minimal placeholder (primary).
insert into public.saju_profiles (
  user_id,
  label,
  is_primary,
  birth_date,
  birth_time_unknown,
  calendar_type,
  timezone,
  pillars,
  calculation_version,
  reconstructed,
  schema_version
)
select distinct u.uid, '기본', true, date '1900-01-01', true, 'solar', 'Asia/Seoul',
  '{}'::jsonb, '0.1.0-placeholder', true, 2
from (
  select user_id as uid from public.journal_entries
  union
  select user_id from public.user_category_preferences
  union
  select user_id from public.journal_onboarding_profiles
  union
  select user_id from public.daily_questions
  union
  select user_id from public.daily_insight_contexts
  union
  select user_id from public.daily_fortunes
  union
  select user_id from public.daily_quote_deliveries
  union
  select user_id from public.question_feedback_events
  union
  select user_id from public.content_exposure_events
  union
  select user_id from public.content_feedback
  union
  select user_id from public.diary_entries
  union
  select user_id from public.daily_forecasts
) u
where not exists (
  select 1 from public.saju_profiles sp where sp.user_id = u.uid
);

-- ---------------------------------------------------------------------------
-- journal_entries
-- ---------------------------------------------------------------------------
alter table public.journal_entries
  add column if not exists saju_profile_id uuid references public.saju_profiles(id) on delete cascade;

update public.journal_entries je
set saju_profile_id = public.resolve_primary_saju_profile_id(je.user_id)
where je.saju_profile_id is null;

alter table public.journal_entries
  alter column saju_profile_id set not null;

alter table public.journal_entries
  drop constraint if exists journal_entries_user_id_entry_date_key;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'journal_entries_user_id_entry_date_key'
  ) then
    alter table public.journal_entries drop constraint journal_entries_user_id_entry_date_key;
  end if;
exception when undefined_object then null;
end $$;

-- Drop any unique on (user_id, entry_date) by scanning
do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'journal_entries'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) like '%user_id%'
      and pg_get_constraintdef(c.oid) like '%entry_date%'
      and pg_get_constraintdef(c.oid) not like '%saju_profile_id%'
  loop
    execute format('alter table public.journal_entries drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.journal_entries
  drop constraint if exists journal_entries_user_profile_date_key;
alter table public.journal_entries
  add constraint journal_entries_user_profile_date_key
  unique (user_id, saju_profile_id, entry_date);

create index if not exists journal_entries_user_profile_date_idx
  on public.journal_entries (user_id, saju_profile_id, entry_date desc);

-- ---------------------------------------------------------------------------
-- user_category_preferences — rebuild PK to include saju_profile_id
-- ---------------------------------------------------------------------------
alter table public.user_category_preferences
  add column if not exists saju_profile_id uuid references public.saju_profiles(id) on delete cascade;

update public.user_category_preferences p
set saju_profile_id = public.resolve_primary_saju_profile_id(p.user_id)
where p.saju_profile_id is null;

alter table public.user_category_preferences
  alter column saju_profile_id set not null;

alter table public.user_category_preferences drop constraint if exists user_category_preferences_pkey;

alter table public.user_category_preferences
  add constraint user_category_preferences_pkey
  primary key (user_id, saju_profile_id, category_code);

create index if not exists user_category_preferences_user_profile_idx
  on public.user_category_preferences (user_id, saju_profile_id, enabled, sort_order);

-- ---------------------------------------------------------------------------
-- journal_onboarding_profiles — composite PK via table rebuild
-- ---------------------------------------------------------------------------
create table if not exists public.journal_onboarding_profiles_v2 (
  user_id uuid not null references auth.users(id) on delete cascade,
  saju_profile_id uuid not null references public.saju_profiles(id) on delete cascade,
  onboarding_version text not null,
  answers jsonb not null default '{}'::jsonb,
  derived jsonb not null default '{}'::jsonb,
  completeness numeric(4,3) not null default 0,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, saju_profile_id)
);

insert into public.journal_onboarding_profiles_v2 (
  user_id, saju_profile_id, onboarding_version, answers, derived,
  completeness, completed, created_at, updated_at
)
select
  o.user_id,
  public.resolve_primary_saju_profile_id(o.user_id),
  o.onboarding_version,
  o.answers,
  o.derived,
  o.completeness,
  o.completed,
  o.created_at,
  o.updated_at
from public.journal_onboarding_profiles o
where public.resolve_primary_saju_profile_id(o.user_id) is not null
on conflict do nothing;

drop table if exists public.journal_onboarding_profiles cascade;
alter table public.journal_onboarding_profiles_v2 rename to journal_onboarding_profiles;

create index if not exists journal_onboarding_profiles_completed_idx
  on public.journal_onboarding_profiles (completed);

alter table public.journal_onboarding_profiles enable row level security;

drop policy if exists "Users own journal_onboarding_profiles"
  on public.journal_onboarding_profiles;
create policy "Users own journal_onboarding_profiles"
  on public.journal_onboarding_profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- daily_questions
-- ---------------------------------------------------------------------------
alter table public.daily_questions
  add column if not exists saju_profile_id uuid references public.saju_profiles(id) on delete cascade;

update public.daily_questions q
set saju_profile_id = public.resolve_primary_saju_profile_id(q.user_id)
where q.saju_profile_id is null;

delete from public.daily_questions where saju_profile_id is null;

alter table public.daily_questions
  alter column saju_profile_id set not null;

do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'daily_questions' and c.contype = 'u'
      and pg_get_constraintdef(c.oid) like '%user_id%'
      and pg_get_constraintdef(c.oid) like '%question_date%'
      and pg_get_constraintdef(c.oid) not like '%saju_profile_id%'
  loop
    execute format('alter table public.daily_questions drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.daily_questions
  drop constraint if exists daily_questions_user_profile_date_key;
alter table public.daily_questions
  add constraint daily_questions_user_profile_date_key
  unique (user_id, saju_profile_id, question_date);

create index if not exists daily_questions_user_profile_date_idx
  on public.daily_questions (user_id, saju_profile_id, question_date desc);

-- ---------------------------------------------------------------------------
-- daily_insight_contexts
-- ---------------------------------------------------------------------------
alter table public.daily_insight_contexts
  add column if not exists saju_profile_id uuid references public.saju_profiles(id) on delete cascade;

update public.daily_insight_contexts c
set saju_profile_id = public.resolve_primary_saju_profile_id(c.user_id)
where c.saju_profile_id is null;

delete from public.daily_insight_contexts where saju_profile_id is null;

alter table public.daily_insight_contexts
  alter column saju_profile_id set not null;

do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'daily_insight_contexts' and c.contype = 'u'
      and pg_get_constraintdef(c.oid) like '%user_id%'
      and pg_get_constraintdef(c.oid) like '%event_date%'
      and pg_get_constraintdef(c.oid) not like '%saju_profile_id%'
  loop
    execute format('alter table public.daily_insight_contexts drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.daily_insight_contexts
  drop constraint if exists daily_insight_contexts_user_profile_date_key;
alter table public.daily_insight_contexts
  add constraint daily_insight_contexts_user_profile_date_key
  unique (user_id, saju_profile_id, event_date);

create index if not exists daily_insight_contexts_user_profile_date_idx
  on public.daily_insight_contexts (user_id, saju_profile_id, event_date desc);

-- ---------------------------------------------------------------------------
-- daily_fortunes
-- ---------------------------------------------------------------------------
alter table public.daily_fortunes
  add column if not exists saju_profile_id uuid references public.saju_profiles(id) on delete cascade;

update public.daily_fortunes f
set saju_profile_id = public.resolve_primary_saju_profile_id(f.user_id)
where f.saju_profile_id is null;

delete from public.daily_fortunes where saju_profile_id is null;

alter table public.daily_fortunes
  alter column saju_profile_id set not null;

do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'daily_fortunes' and c.contype = 'u'
      and pg_get_constraintdef(c.oid) like '%user_id%'
      and pg_get_constraintdef(c.oid) like '%event_date%'
      and pg_get_constraintdef(c.oid) not like '%saju_profile_id%'
  loop
    execute format('alter table public.daily_fortunes drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.daily_fortunes
  drop constraint if exists daily_fortunes_user_profile_date_key;
alter table public.daily_fortunes
  add constraint daily_fortunes_user_profile_date_key
  unique (user_id, saju_profile_id, event_date);

create index if not exists daily_fortunes_user_profile_date_idx
  on public.daily_fortunes (user_id, saju_profile_id, event_date desc);

-- ---------------------------------------------------------------------------
-- daily_quote_deliveries
-- ---------------------------------------------------------------------------
alter table public.daily_quote_deliveries
  add column if not exists saju_profile_id uuid references public.saju_profiles(id) on delete cascade;

update public.daily_quote_deliveries d
set saju_profile_id = public.resolve_primary_saju_profile_id(d.user_id)
where d.saju_profile_id is null;

delete from public.daily_quote_deliveries where saju_profile_id is null;

alter table public.daily_quote_deliveries
  alter column saju_profile_id set not null;

-- Deduplicate same-day deliveries before unique
delete from public.daily_quote_deliveries d
using public.daily_quote_deliveries newer
where d.user_id = newer.user_id
  and d.saju_profile_id = newer.saju_profile_id
  and d.event_date = newer.event_date
  and d.delivered_at < newer.delivered_at;

alter table public.daily_quote_deliveries
  drop constraint if exists daily_quote_deliveries_user_profile_date_key;
alter table public.daily_quote_deliveries
  add constraint daily_quote_deliveries_user_profile_date_key
  unique (user_id, saju_profile_id, event_date);

create index if not exists daily_quote_deliveries_user_profile_date_idx
  on public.daily_quote_deliveries (user_id, saju_profile_id, event_date desc);

-- ---------------------------------------------------------------------------
-- question_feedback_events / content_exposure_events / content_feedback
-- ---------------------------------------------------------------------------
alter table public.question_feedback_events
  add column if not exists saju_profile_id uuid references public.saju_profiles(id) on delete cascade;

update public.question_feedback_events e
set saju_profile_id = public.resolve_primary_saju_profile_id(e.user_id)
where e.saju_profile_id is null;

alter table public.content_exposure_events
  add column if not exists saju_profile_id uuid references public.saju_profiles(id) on delete cascade;

update public.content_exposure_events e
set saju_profile_id = public.resolve_primary_saju_profile_id(e.user_id)
where e.saju_profile_id is null;

alter table public.content_feedback
  add column if not exists saju_profile_id uuid references public.saju_profiles(id) on delete cascade;

update public.content_feedback e
set saju_profile_id = public.resolve_primary_saju_profile_id(e.user_id)
where e.saju_profile_id is null;

create index if not exists question_feedback_events_user_profile_date_idx
  on public.question_feedback_events (user_id, saju_profile_id, question_date desc);

create index if not exists content_exposure_events_user_profile_date_idx
  on public.content_exposure_events (user_id, saju_profile_id, event_date desc, occurred_at desc);

create index if not exists content_feedback_user_profile_date_idx
  on public.content_feedback (user_id, saju_profile_id, event_date desc);

-- ---------------------------------------------------------------------------
-- diary_entries / daily_forecasts (column may already exist)
-- ---------------------------------------------------------------------------
alter table public.diary_entries
  add column if not exists saju_profile_id uuid references public.saju_profiles(id) on delete set null;

update public.diary_entries d
set saju_profile_id = public.resolve_primary_saju_profile_id(d.user_id)
where d.saju_profile_id is null;

do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'diary_entries' and c.contype = 'u'
      and pg_get_constraintdef(c.oid) like '%user_id%'
      and pg_get_constraintdef(c.oid) like '%date%'
      and pg_get_constraintdef(c.oid) not like '%saju_profile_id%'
  loop
    execute format('alter table public.diary_entries drop constraint %I', r.conname);
  end loop;
end $$;

-- Allow multiple nulls during transition; prefer profile-scoped unique when set
create unique index if not exists diary_entries_user_profile_date_uidx
  on public.diary_entries (user_id, saju_profile_id, date)
  where saju_profile_id is not null;

alter table public.daily_forecasts
  add column if not exists saju_profile_id uuid references public.saju_profiles(id) on delete set null;

update public.daily_forecasts f
set saju_profile_id = public.resolve_primary_saju_profile_id(f.user_id)
where f.saju_profile_id is null;

do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'daily_forecasts' and c.contype = 'u'
      and pg_get_constraintdef(c.oid) like '%user_id%'
      and pg_get_constraintdef(c.oid) like '%target_date%'
      and pg_get_constraintdef(c.oid) not like '%saju_profile_id%'
  loop
    execute format('alter table public.daily_forecasts drop constraint %I', r.conname);
  end loop;
end $$;

create unique index if not exists daily_forecasts_user_profile_date_uidx
  on public.daily_forecasts (user_id, saju_profile_id, target_date)
  where saju_profile_id is not null;

comment on column public.journal_entries.saju_profile_id is
  'Active saju profile that owns this journal entry (per-profile isolation).';
