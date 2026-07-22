/**
 * Phase 6.1 — conservative feature-flag unit check (no browser).
 */
import { describe, expect, test } from "@jest/globals";

describe("Phase 6.1 conservative flags", () => {
  test("envBool matrix matches release recommendation", () => {
    const prev = { ...process.env };
    delete process.env.NEXT_PUBLIC_E2E_CONSERVATIVE_FLAGS;
    process.env.NEXT_PUBLIC_FF_NEW_DIARY = "true";
    process.env.NEXT_PUBLIC_FF_SAJU_SNAPSHOT = "true";
    process.env.NEXT_PUBLIC_FF_PERSONALIZATION_TRAIN = "false";
    process.env.NEXT_PUBLIC_FF_PERSONALIZATION_DISPLAY = "false";
    process.env.NEXT_PUBLIC_FF_PERSONALIZATION = "false";
    process.env.NEXT_PUBLIC_FF_NEW_ANALYSIS = "true";
    process.env.NEXT_PUBLIC_FF_ANALYSIS_NARRATIVE_LLM = "false";
    process.env.FF_ANALYSIS_NARRATIVE_LLM = "false";
    process.env.NEXT_PUBLIC_FF_ANALYSIS_CACHE = "false";

    // Re-require after env set — featureFlags reads process.env at call time
    jest.resetModules();
    const flags = require("@/lib/app/featureFlags") as typeof import("@/lib/app/featureFlags");
    expect(flags.isNewDiaryEnabled()).toBe(true);
    expect(flags.isSajuFeatureSnapshotEnabled()).toBe(true);
    expect(flags.isPersonalizationTrainEnabled()).toBe(false);
    expect(flags.isPersonalizationEnabled()).toBe(false);
    expect(flags.isNewAnalysisEnabled()).toBe(true);
    expect(flags.isAnalysisNarrativeLlmEnabled()).toBe(false);
    expect(flags.isAnalysisCacheEnabled()).toBe(false);

    process.env = prev;
    jest.resetModules();
  });

  test("NEXT_PUBLIC_E2E_CONSERVATIVE_FLAGS forces conservative matrix", () => {
    const prev = { ...process.env };
    process.env.NEXT_PUBLIC_E2E_CONSERVATIVE_FLAGS = "true";
    // Conflicting env should be ignored under E2E override
    process.env.NEXT_PUBLIC_FF_NEW_DIARY = "false";
    process.env.NEXT_PUBLIC_FF_NEW_ANALYSIS = "false";
    process.env.NEXT_PUBLIC_FF_PERSONALIZATION_DISPLAY = "true";

    jest.resetModules();
    const flags = require("@/lib/app/featureFlags") as typeof import("@/lib/app/featureFlags");
    expect(flags.isNewDiaryEnabled()).toBe(true);
    expect(flags.isNewAnalysisEnabled()).toBe(true);
    expect(flags.isSajuFeatureSnapshotEnabled()).toBe(true);
    expect(flags.isPersonalizationEnabled()).toBe(false);
    expect(flags.isAnalysisNarrativeLlmEnabled()).toBe(false);

    process.env = prev;
    jest.resetModules();
  });
});
