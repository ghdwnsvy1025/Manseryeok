/**
 * Resolve the active (primary) saju profile id for a user.
 * Prefer user_profiles.active_saju_profile_id, then is_primary, then oldest.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSajuProfileId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export async function resolveActiveSajuProfileId(
  sb: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: userProfile } = await sb
    .from("user_profiles")
    .select("active_saju_profile_id")
    .eq("id", userId)
    .maybeSingle();

  const active = userProfile?.active_saju_profile_id;
  if (isSajuProfileId(active)) {
    const { data: owned } = await sb
      .from("saju_profiles")
      .select("id")
      .eq("id", active)
      .eq("user_id", userId)
      .maybeSingle();
    if (owned?.id) return String(owned.id);
  }

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

/** Client-side: primary from already-loaded list / local cache */
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
