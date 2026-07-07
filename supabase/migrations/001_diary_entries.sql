-- Supabase SQL: 일기 테이블 (Dashboard → SQL Editor에서 실행)

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

create policy "Users can read own diary entries"
  on public.diary_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert own diary entries"
  on public.diary_entries for insert
  with check (auth.uid() = user_id);

create policy "Users can update own diary entries"
  on public.diary_entries for update
  using (auth.uid() = user_id);

create policy "Users can delete own diary entries"
  on public.diary_entries for delete
  using (auth.uid() = user_id);
