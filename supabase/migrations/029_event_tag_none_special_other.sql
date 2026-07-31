-- 클라이언트 EVENT_TAG_CATALOG에만 있던 태그 — journal_entry_tags FK 때문에 저장 실패하던 문제
insert into public.event_tag_catalog (tag_code, name, sort_order, is_system)
values
  ('none_special', '특별한 일 없음', 16, true),
  ('other', '기타', 17, true)
on conflict (tag_code) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  updated_at = now();
