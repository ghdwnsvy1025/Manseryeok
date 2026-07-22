import {
  DEFAULT_FEATURE_FLAGS,
  getFeatureFlags,
  isLegacyMenuEnabled,
  isNewAnalysisEnabled,
  isNewDiaryEnabled,
  isPersonalizationEnabled,
  isPersonalizationTrainEnabled,
} from "@/lib/app/featureFlags";

describe("featureFlags (Phase 1 + 4 + 5)", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  test("기본값은 신규 기능 OFF", () => {
    expect(DEFAULT_FEATURE_FLAGS.newDiaryEnabled).toBe(false);
    expect(DEFAULT_FEATURE_FLAGS.personalizationEnabled).toBe(false);
    expect(DEFAULT_FEATURE_FLAGS.personalizationTrainEnabled).toBe(false);
    expect(DEFAULT_FEATURE_FLAGS.personalizationDisplayEnabled).toBe(false);
    expect(DEFAULT_FEATURE_FLAGS.newAnalysisEnabled).toBe(false);
    expect(DEFAULT_FEATURE_FLAGS.analysisNarrativeLlmEnabled).toBe(false);
    expect(DEFAULT_FEATURE_FLAGS.analysisCacheEnabled).toBe(false);
    expect(DEFAULT_FEATURE_FLAGS.sajuFeatureSnapshotEnabled).toBe(false);
  });

  test("환경변수 미설정 시 OFF", () => {
    delete process.env.NEXT_PUBLIC_FF_NEW_DIARY;
    delete process.env.NEXT_PUBLIC_FF_PERSONALIZATION;
    delete process.env.NEXT_PUBLIC_FF_PERSONALIZATION_TRAIN;
    delete process.env.NEXT_PUBLIC_FF_PERSONALIZATION_DISPLAY;
    delete process.env.NEXT_PUBLIC_FF_NEW_ANALYSIS;
    const flags = getFeatureFlags();
    expect(flags.newDiaryEnabled).toBe(false);
    expect(isNewDiaryEnabled()).toBe(false);
    expect(isPersonalizationEnabled()).toBe(false);
    expect(isPersonalizationTrainEnabled()).toBe(false);
    expect(isNewAnalysisEnabled()).toBe(false);
    expect(isLegacyMenuEnabled()).toBe(false);
  });

  test("학습 ON / 표시 OFF 분리", () => {
    process.env.NEXT_PUBLIC_FF_PERSONALIZATION_TRAIN = "true";
    process.env.NEXT_PUBLIC_FF_PERSONALIZATION_DISPLAY = "false";
    delete process.env.NEXT_PUBLIC_FF_PERSONALIZATION;
    const flags = getFeatureFlags();
    expect(flags.personalizationTrainEnabled).toBe(true);
    expect(flags.personalizationDisplayEnabled).toBe(false);
  });
});
