-- 사주읽는밤 일기 — 핵심 테이블 6개 (재구축 1단계, 2026-10-04)
--
-- 레거시 테이블(journal_entries, saju_profiles 등)은 건드리지 않는다. 새 테이블은 모두 night_ 접두어.
-- 여러 번 실행해도 안전하다 (if not exists / drop policy if exists).
-- 적용: Supabase Dashboard → SQL Editor에 이 파일 전체를 붙여 넣고 Run.

begin;

-- 공통: updated_at 자동 갱신 ------------------------------------------------
create or replace function public.night_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1. 사용자 -----------------------------------------------------------------
create table if not exists public.night_profiles (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  display_name          text check (char_length(display_name) <= 40),
  onboarded_at          timestamptz,
  migrated_from_legacy  timestamptz,              -- 5단계 이관 표시
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- 2. 사주 프로필 (계정당 하나) ---------------------------------------------
create table if not exists public.night_saju_profiles (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references auth.users (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 40),
  gender         text not null check (gender in ('male', 'female')),
  calendar       text not null default 'solar' check (calendar in ('solar', 'lunar')),
  is_leap_month  boolean not null default false,
  -- 음력 2월 30일처럼 date 타입에 안 들어가는 입력이 있어 연·월·일을 따로 둔다
  birth_year     smallint not null check (birth_year between 1900 and 2100),
  birth_month    smallint not null check (birth_month between 1 and 12),
  birth_day      smallint not null check (birth_day between 1 and 31),
  birth_hour     smallint check (birth_hour between 0 and 23),       -- null = 시간 모름
  birth_minute   smallint check (birth_minute between 0 and 59),
  city           text not null default 'seoul',
  pillars        jsonb not null,                  -- 엔진 계산 결과 스냅샷 {hour?,day,month,year}
  engine_version text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check ((birth_hour is null) = (birth_minute is null))
);

-- 3. 기록 (하루 하나) -------------------------------------------------------
create table if not exists public.night_entries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  entry_date       date not null,
  happiness        smallint not null check (happiness between 1 and 10),
  moods            text[] not null default '{}' check (cardinality(moods) <= 3),
  note             text check (char_length(note) <= 500),
  -- 그날의 일진. 간지별 행복도 통계의 키. 날짜만으로 정해지므로 저장 시 서버가 계산한다
  day_ganji_index  smallint not null check (day_ganji_index between 0 and 59),
  day_stem         text not null,                 -- 갑~계
  day_branch       text not null,                 -- 자~해
  source           text not null default 'app' check (source in ('app', 'legacy')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, entry_date)
);
create index if not exists night_entries_user_ganji_idx on public.night_entries (user_id, day_ganji_index);

-- 4. 운세 캐시 (사용자 또는 게스트 × 날짜) ----------------------------------
create table if not exists public.night_fortunes (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users (id) on delete cascade,
  guest_key           text,                       -- 게스트: 생년월일시 지문의 해시
  fortune_date        date not null,
  profile_fingerprint text not null,              -- 프로필이 바뀌면 다시 만든다
  score               numeric(4, 2) not null,
  content             jsonb not null,
  model               text,
  tokens_in           integer,
  tokens_out          integer,
  created_at          timestamptz not null default now(),
  check ((user_id is null) <> (guest_key is null))
);
create unique index if not exists night_fortunes_user_date_uq
  on public.night_fortunes (user_id, fortune_date) where user_id is not null;
create unique index if not exists night_fortunes_guest_date_uq
  on public.night_fortunes (guest_key, fortune_date) where guest_key is not null;

-- 5. 운세 피드백 (👍 1 / 👎 -1) ----------------------------------------------
create table if not exists public.night_fortune_feedback (
  user_id       uuid not null references auth.users (id) on delete cascade,
  fortune_date  date not null,
  vote          smallint not null check (vote in (-1, 1)),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, fortune_date)
);

-- 6. 알림 설정 --------------------------------------------------------------
create table if not exists public.night_notification_settings (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  enabled       boolean not null default false,
  remind_at     time not null default '21:00',
  timezone      text not null default 'Asia/Seoul',
  web_push      jsonb,                            -- PushSubscription JSON
  kakao_opt_in  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- updated_at 트리거 ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['night_profiles', 'night_saju_profiles', 'night_entries',
                           'night_fortune_feedback', 'night_notification_settings']
  loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I
                    for each row execute function public.night_touch_updated_at()', t, t);
  end loop;
end $$;

-- RLS: 본인 행만 -------------------------------------------------------------
alter table public.night_profiles               enable row level security;
alter table public.night_saju_profiles          enable row level security;
alter table public.night_entries                enable row level security;
alter table public.night_fortunes               enable row level security;
alter table public.night_fortune_feedback       enable row level security;
alter table public.night_notification_settings  enable row level security;

do $$
declare t text;
begin
  -- 읽기·쓰기·고치기·지우기 모두 본인 것만
  foreach t in array array['night_profiles', 'night_saju_profiles', 'night_entries',
                           'night_fortune_feedback', 'night_notification_settings']
  loop
    execute format('drop policy if exists "%s_own" on public.%I', t, t);
    execute format('create policy "%s_own" on public.%I for all to authenticated
                    using ((select auth.uid()) = user_id)
                    with check ((select auth.uid()) = user_id)', t, t);
  end loop;
end $$;

-- 운세는 본인 것 읽기만. 만들기는 서버(service role)만 한다
drop policy if exists "night_fortunes_read_own" on public.night_fortunes;
create policy "night_fortunes_read_own" on public.night_fortunes for select to authenticated
  using ((select auth.uid()) = user_id);

commit;
