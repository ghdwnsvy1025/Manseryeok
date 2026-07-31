/**
 * 계정 삭제 — 파생 데이터는 DB FK ON DELETE CASCADE에 위임.
 * HTTP 장시간 작업으로 수동 purge하지 않는다.
 */

/** auth.users 삭제 시 cascade로 사라져야 하는 앱 테이블 */
export const ACCOUNT_CASCADE_TABLES = [
  "journal_entries",
  "category_scores",
  "journal_entry_tags",
  "daily_insight_contexts",
  "daily_fortunes",
  "daily_fortune_sections",
  "daily_questions",
  "question_feedback_events",
  "daily_quote_deliveries",
  "content_exposure_events",
  "content_feedback",
  "beta_feedback",
  "astrology_profiles",
  "astrology_snapshots",
  "astrology_feature_vectors",
  "personalization_models",
  "journal_onboarding_profiles",
  "saju_profiles",
  "diary_entries",
] as const;

export const ACCOUNT_DELETE_CONFIRM_PHRASE = "DELETE MY ACCOUNT";

export function validateAccountDeleteConfirmation(
  confirmation: unknown
): { ok: true } | { ok: false; error: string } {
  if (confirmation !== ACCOUNT_DELETE_CONFIRM_PHRASE) {
    return {
      ok: false,
      error: `확인 문구가 필요합니다: ${ACCOUNT_DELETE_CONFIRM_PHRASE}`,
    };
  }
  return { ok: true };
}

export type CascadeProbeResult = {
  table: string;
  remaining: number;
};

/**
 * 삭제 후 잔존 행 수를 모은다. remaining>0이면 cascade 누락.
 * 원문·개인정보는 결과에 넣지 않는다.
 */
export function summarizeCascadeProbes(
  probes: CascadeProbeResult[]
): { ok: boolean; leftoverTables: string[] } {
  const leftoverTables = probes
    .filter((p) => p.remaining > 0)
    .map((p) => p.table);
  return { ok: leftoverTables.length === 0, leftoverTables };
}
