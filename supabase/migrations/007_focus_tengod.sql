-- Phase 1: A 필드 확장 (집중) + B 메타(십신)는 weather_metadata에도 백업 가능
alter table public.diary_entries
  add column if not exists focus_rating smallint,
  add column if not exists ten_god text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'diary_entries_focus_rating_check'
  ) then
    alter table public.diary_entries
      add constraint diary_entries_focus_rating_check
      check (focus_rating is null or (focus_rating between 1 and 5));
  end if;
end $$;
