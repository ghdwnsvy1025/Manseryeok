/**
 * Resolve active saju profile ids.
 * Journal = diary/checkin/fortune scope; View = manseryeok display.
 * Prefer active_journal_profile_id / active_view_profile_id, then legacy
 * active_saju_profile_id, then is_primary, then oldest.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSajuProfileId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

async function ownedProfileId(
  sb: SupabaseClient,
  userId: string,
  candidate: unknown
): Promise<string | null> {
  if (!isSajuProfileId(candidate)) return null;
  const { data: owned } = await sb
    .from("saju_profiles")
    .select("id")
    .eq("id", candidate)
    .eq("user_id", userId)
    .maybeSingle();
  return owned?.id ? String(owned.id) : null;
}

async function fallbackPrimaryOrOldest(
  sb: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: primary } = await sb
    .from("saju_profiles")
    .select("id")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .maybeSingle();
  if (primary?.id) return String(primary.id);

  const { data: oldest } = await sb
    .from("saju_profiles")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return oldest?.id ? String(oldest.id) : null;
}

async function loadUserProfileRow(
  sb: SupabaseClient,
  userId: string
): Promise<Record<string, unknown> | null> {
  const full = await sb
    .from("user_profiles")
    .select(
      "active_saju_profile_id, active_journal_profile_id, active_view_profile_id"
    )
    .eq("id", userId)
    .maybeSingle();
  if (!full.error && full.data) return full.data as Record<string, unknown>;

  // Migration 026 not applied yet
  const legacy = await sb
    .from("user_profiles")
    .select("active_saju_profile_id")
    .eq("id", userId)
    .maybeSingle();
  if (!legacy.error && legacy.data) return legacy.data as Record<string, unknown>;
  return null;
}

/** Journal-scoped active profile (API persist / RLS app filter). */
export async function resolveActiveSajuProfileId(
  sb: SupabaseClient,
  userId: string
): Promise<string | null> {
  return resolveJournalSajuProfileId(sb, userId);
}

export async function resolveJournalSajuProfileId(
  sb: SupabaseClient,
  userId: string
): Promise<string | null> {
  const row = await loadUserProfileRow(sb, userId);
  const fromJournal = await ownedProfileId(
    sb,
    userId,
    row?.active_journal_profile_id
  );
  if (fromJournal) return fromJournal;

  const fromLegacy = await ownedProfileId(
    sb,
    userId,
    row?.active_saju_profile_id
  );
  if (fromLegacy) return fromLegacy;

  return fallbackPrimaryOrOldest(sb, userId);
}

export async function resolveViewSajuProfileId(
  sb: SupabaseClient,
  userId: string
): Promise<string | null> {
  const row = await loadUserProfileRow(sb, userId);
  const fromView = await ownedProfileId(sb, userId, row?.active_view_profile_id);
  if (fromView) return fromView;
  return resolveJournalSajuProfileId(sb, userId);
}

/** Client-side: preferred id, then primary, then first. */
export function pickActiveSajuProfileId(
  profiles: Array<{ id: string; isPrimary?: boolean }>,
  preferredId?: string | null
): string | null {
  if (preferredId && profiles.some((p) => p.id === preferredId)) {
    return preferredId;
  }
  const primary = profiles.find((p) => p.isPrimary);
  if (primary) return primary.id;
  return profiles[0]?.id ?? null;
}
