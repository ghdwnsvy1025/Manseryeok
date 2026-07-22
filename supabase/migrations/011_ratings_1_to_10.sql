-- Expand diary happiness / condition / focus ratings from 1–5 to 1–10.
-- Energy stays 1–4.

-- Drop old check constraints (names may vary by environment)
alter table public.diary_entries
  drop constraint if exists diary_entries_happiness_rating_check;

alter table public.diary_entries
  drop constraint if exists diary_entries_condition_rating_check;

alter table public.diary_entries
  drop constraint if exists diary_entries_focus_rating_check;

-- Rescale legacy 1–5 values → 1–10 (1→1, 3→6, 5→10)
update public.diary_entries
set happiness_rating = round(1 + (happiness_rating - 1) * 9.0 / 4)
where happiness_rating is not null
  and happiness_rating between 1 and 5;

update public.diary_entries
set condition_rating = round(1 + (condition_rating - 1) * 9.0 / 4)
where condition_rating is not null
  and condition_rating between 1 and 5;

update public.diary_entries
set focus_rating = round(1 + (focus_rating - 1) * 9.0 / 4)
where focus_rating is not null
  and focus_rating between 1 and 5;

alter table public.diary_entries
  add constraint diary_entries_happiness_rating_check
  check (happiness_rating is null or (happiness_rating between 1 and 10));

alter table public.diary_entries
  add constraint diary_entries_condition_rating_check
  check (condition_rating is null or (condition_rating between 1 and 10));

alter table public.diary_entries
  add constraint diary_entries_focus_rating_check
  check (focus_rating is null or (focus_rating between 1 and 10));
