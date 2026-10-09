-- 0004: 공유 버튼을 누른 횟수 (2026-10-10). 누가 눌렀는지는 남기지 않는다 — 시각·종류·방법만.
-- 서버(service role)만 쓴다. RLS를 켜고 정책을 두지 않아 브라우저(anon/authenticated)는 읽고 쓸 수 없다.
create table if not exists public.night_share_events (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind       text not null check (kind in ('fortune')),
  method     text check (method in ('image', 'link', 'download'))
);
alter table public.night_share_events enable row level security;

-- 날짜별 횟수 보기 (SQL Editor에서):
-- select (created_at at time zone 'Asia/Seoul')::date as day, kind, method, count(*)
--   from public.night_share_events group by 1, 2, 3 order by 1 desc;
