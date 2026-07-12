-- 년운(년주) 한글 간지 저장

alter table public.diary_entries
  add column if not exists year_pillar_ko text;
