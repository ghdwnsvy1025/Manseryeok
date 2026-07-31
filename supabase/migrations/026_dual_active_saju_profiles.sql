-- 026: Separate journal vs manseryeok-view active saju profiles
-- Keeps active_saju_profile_id as journal alias for backward compatibility.

alter table public.user_profiles
  add column if not exists active_journal_profile_id uuid;

alter table public.user_profiles
  add column if not exists active_view_profile_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_active_journal_profile_id_fkey'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_active_journal_profile_id_fkey
      foreign key (active_journal_profile_id)
      references public.saju_profiles(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_active_view_profile_id_fkey'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_active_view_profile_id_fkey
      foreign key (active_view_profile_id)
      references public.saju_profiles(id)
      on delete set null;
  end if;
end $$;

-- Backfill from legacy active_saju_profile_id / primary profile
update public.user_profiles up
set
  active_journal_profile_id = coalesce(
    up.active_journal_profile_id,
    up.active_saju_profile_id,
    (
      select sp.id
      from public.saju_profiles sp
      where sp.user_id = up.id
      order by sp.is_primary desc, sp.created_at asc
      limit 1
    )
  ),
  active_view_profile_id = coalesce(
    up.active_view_profile_id,
    up.active_saju_profile_id,
    up.active_journal_profile_id,
    (
      select sp.id
      from public.saju_profiles sp
      where sp.user_id = up.id
      order by sp.is_primary desc, sp.created_at asc
      limit 1
    )
  )
where up.active_journal_profile_id is null
   or up.active_view_profile_id is null;

-- Keep legacy column aligned with journal when journal is set
update public.user_profiles
set active_saju_profile_id = active_journal_profile_id
where active_journal_profile_id is not null
  and (
    active_saju_profile_id is null
    or active_saju_profile_id is distinct from active_journal_profile_id
  );
