-- 027: 원국 종합풀이 캐시 (프로필당 1건, input_hash로 무효화)

create table if not exists public.saju_natal_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  saju_profile_id uuid not null references public.saju_profiles(id) on delete cascade,
  input_hash text not null,
  prompt_version text not null default '',
  model_version text,
  digest_version text,
  reading_json jsonb not null default '{}'::jsonb,
  theory_used boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, saju_profile_id)
);

create index if not exists saju_natal_readings_user_idx
  on public.saju_natal_readings (user_id, updated_at desc);

alter table public.saju_natal_readings enable row level security;

drop policy if exists "Users own saju_natal_readings" on public.saju_natal_readings;
create policy "Users own saju_natal_readings"
  on public.saju_natal_readings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
