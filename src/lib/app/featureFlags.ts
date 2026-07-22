/**
 * 개편용 기능 플래그
 * Phase 4 — 개인화 Ridge MVP: 학습/표시 분리
 * Phase 5 — 분석 UI·서술: 화면 / LLM / 캐시 분리
 *
 * IMPORTANT: Next.js only inlines `process.env.NEXT_PUBLIC_*` when accessed
 * as a static property (not `process.env[name]`). Always use direct reads.
 */

export type FeatureFlags = {
  legacyMenuEnabled: boolean;
  newDiaryEnabled: boolean;
  /** @deprecated → personalizationDisplayEnabled */
  personalizationEnabled: boolean;
  personalizationTrainEnabled: boolean;
  personalizationDisplayEnabled: boolean;
  /** Phase 5 — 분석 UI 노출 */
  newAnalysisEnabled: boolean;
  /** Phase 5 — LLM 서술 (서버 FF_ANALYSIS_NARRATIVE_LLM 과 병행; 클라 힌트용) */
  analysisNarrativeLlmEnabled: boolean;
  /** Phase 5 — 분석 캐시 (미사용 시에도 OFF) */
  analysisCacheEnabled: boolean;
  sajuFeatureSnapshotEnabled: boolean;
};

const TRUE = new Set(["1", "true", "yes", "on"]);

function asBool(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw == null || raw === "") return defaultValue;
  return TRUE.has(String(raw).trim().toLowerCase());
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  legacyMenuEnabled: false,
  newDiaryEnabled: false,
  personalizationEnabled: false,
  personalizationTrainEnabled: false,
  personalizationDisplayEnabled: false,
  newAnalysisEnabled: false,
  analysisNarrativeLlmEnabled: false,
  analysisCacheEnabled: false,
  sajuFeatureSnapshotEnabled: false,
};

/** Playwright Phase 6.1 — bake-safe conservative matrix */
function e2eConservativeOverride(): FeatureFlags | null {
  if (
    !asBool(process.env.NEXT_PUBLIC_E2E_CONSERVATIVE_FLAGS, false)
  ) {
    return null;
  }
  return {
    ...DEFAULT_FEATURE_FLAGS,
    newDiaryEnabled: true,
    sajuFeatureSnapshotEnabled: true,
    personalizationTrainEnabled: false,
    personalizationDisplayEnabled: false,
    personalizationEnabled: false,
    newAnalysisEnabled: true,
    analysisNarrativeLlmEnabled: false,
    analysisCacheEnabled: false,
  };
}

export function getFeatureFlags(): FeatureFlags {
  const e2e = e2eConservativeOverride();
  if (e2e) return e2e;

  const train = asBool(
    process.env.NEXT_PUBLIC_FF_PERSONALIZATION_TRAIN,
    DEFAULT_FEATURE_FLAGS.personalizationTrainEnabled
  );
  const display =
    asBool(
      process.env.NEXT_PUBLIC_FF_PERSONALIZATION_DISPLAY,
      DEFAULT_FEATURE_FLAGS.personalizationDisplayEnabled
    ) ||
    asBool(
      process.env.NEXT_PUBLIC_FF_PERSONALIZATION,
      DEFAULT_FEATURE_FLAGS.personalizationEnabled
    );

  return {
    legacyMenuEnabled: asBool(
      process.env.NEXT_PUBLIC_FF_LEGACY_MENU,
      DEFAULT_FEATURE_FLAGS.legacyMenuEnabled
    ),
    newDiaryEnabled: asBool(
      process.env.NEXT_PUBLIC_FF_NEW_DIARY,
      DEFAULT_FEATURE_FLAGS.newDiaryEnabled
    ),
    personalizationEnabled: display,
    personalizationTrainEnabled: train,
    personalizationDisplayEnabled: display,
    newAnalysisEnabled: asBool(
      process.env.NEXT_PUBLIC_FF_NEW_ANALYSIS,
      DEFAULT_FEATURE_FLAGS.newAnalysisEnabled
    ),
    analysisNarrativeLlmEnabled: asBool(
      process.env.NEXT_PUBLIC_FF_ANALYSIS_NARRATIVE_LLM,
      DEFAULT_FEATURE_FLAGS.analysisNarrativeLlmEnabled
    ),
    analysisCacheEnabled: asBool(
      process.env.NEXT_PUBLIC_FF_ANALYSIS_CACHE,
      DEFAULT_FEATURE_FLAGS.analysisCacheEnabled
    ),
    sajuFeatureSnapshotEnabled: asBool(
      process.env.NEXT_PUBLIC_FF_SAJU_SNAPSHOT,
      DEFAULT_FEATURE_FLAGS.sajuFeatureSnapshotEnabled
    ),
  };
}

export function isNewDiaryEnabled(): boolean {
  return getFeatureFlags().newDiaryEnabled;
}

export function isPersonalizationEnabled(): boolean {
  return getFeatureFlags().personalizationDisplayEnabled;
}

export function isPersonalizationTrainEnabled(): boolean {
  return getFeatureFlags().personalizationTrainEnabled;
}

export function isLegacyMenuEnabled(): boolean {
  return getFeatureFlags().legacyMenuEnabled;
}

export function isSajuFeatureSnapshotEnabled(): boolean {
  return getFeatureFlags().sajuFeatureSnapshotEnabled;
}

export function isNewAnalysisEnabled(): boolean {
  return getFeatureFlags().newAnalysisEnabled;
}

export function isAnalysisNarrativeLlmEnabled(): boolean {
  return getFeatureFlags().analysisNarrativeLlmEnabled;
}

export function isAnalysisCacheEnabled(): boolean {
  return getFeatureFlags().analysisCacheEnabled;
}
