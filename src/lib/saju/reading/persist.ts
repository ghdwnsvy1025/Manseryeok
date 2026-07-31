/**
 * 원국 종합풀이 캐시 persist
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NatalReadingResult } from "./natalReadingTypes";

export async function loadNatalReadingCache(
  sb: SupabaseClient,
  userId: string,
  sajuProfileId: string,
  inputHash: string
): Promise<NatalReadingResult | null> {
  const { data, error } = await sb
    .from("saju_natal_readings")
    .select("input_hash, reading_json")
    .eq("user_id", userId)
    .eq("saju_profile_id", sajuProfileId)
    .maybeSingle();

  if (error || !data) return null;
  if (data.input_hash !== inputHash) return null;
  const reading = data.reading_json as NatalReadingResult | null;
  if (!reading || reading.version !== "natal-v1") return null;
  return reading;
}

export async function persistNatalReading(
  sb: SupabaseClient,
  opts: {
    userId: string;
    sajuProfileId: string;
    inputHash: string;
    reading: NatalReadingResult;
  }
): Promise<void> {
  const { error } = await sb.from("saju_natal_readings").upsert(
    {
      user_id: opts.userId,
      saju_profile_id: opts.sajuProfileId,
      input_hash: opts.inputHash,
      prompt_version: opts.reading.promptVersion,
      model_version: process.env.OPENAI_JOURNAL_SCORE_MODEL || "gpt-4o-mini",
      digest_version: opts.reading.digestVersion,
      reading_json: opts.reading,
      theory_used: opts.reading.theoryUsed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,saju_profile_id" }
  );
  if (error) {
    console.error("[natal-reading persist]", error.message);
  }
}
